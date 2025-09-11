const express = require('express');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const { FamilyGroup, FAMILY_ROLES, INVITATION_STATUS } = require('../models/FamilyGroup');
const { authenticateUser } = require('../middleware/auth');
const admin = require('firebase-admin');
const emailService = require('../services/emailService');

const router = express.Router();

// Create new family group
router.post('/create', authenticateUser, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Family group name is required'
      });
    }

    // Get user details from Firebase
    const userRecord = await admin.auth().getUser(req.user.uid);
    
    // Create simple family group object
    const familyGroupData = {
      _id: new Date().getTime().toString(),
      name: name.trim(),
      description: description ? description.trim() : '',
      createdBy: req.user.uid,
      createdAt: new Date(),
      lastModified: new Date(),
      members: [{
        userId: req.user.uid,
        email: userRecord.email.toLowerCase(),
        displayName: userRecord.displayName || userRecord.email,
        role: 'admin',
        invitedBy: req.user.uid,
        joinedAt: new Date(),
        status: 'active'
      }],
      invitations: [],
      settings: {
        allowMemberInvites: false,
        autoAcceptInvites: false,
        defaultMemberRole: 'member',
        maxMembers: 10
      },
      statistics: {
        totalMembers: 1,
        totalDocuments: 0,
        lastActivity: new Date()
      },
      status: 'active'
    };

    // Try MongoDB first, fallback to in-memory
    try {
      const familyGroup = new FamilyGroup(familyGroupData);
      await familyGroup.save();
      
      res.status(201).json({
        success: true,
        message: 'Family group created successfully',
        familyGroup: familyGroup
      });
    } catch (mongoError) {
      console.warn('MongoDB save failed, using in-memory storage:', mongoError.message);
      
      // Store in memory as fallback
      global.inMemoryData = global.inMemoryData || { familyGroups: new Map() };
      global.inMemoryData.familyGroups.set(familyGroupData._id, familyGroupData);
      
      res.status(201).json({
        success: true,
        message: 'Family group created successfully (in-memory)',
        familyGroup: familyGroupData
      });
    }

  } catch (error) {
    console.error('Create family group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create family group'
    });
  }
});

// Get user's family groups
router.get('/my-groups', authenticateUser, async (req, res) => {
  try {
    let familyGroups = [];
    
    // Try MongoDB first, fallback to in-memory
    try {
      familyGroups = await FamilyGroup.find({
        $or: [
          { createdBy: req.user.uid },
          { 'members.userId': req.user.uid, 'members.status': 'active' }
        ],
        status: 'active'
      }).sort({ lastModified: -1 });
    } catch (mongoError) {
      console.warn('MongoDB query failed, checking in-memory storage:', mongoError.message);
      
      // Check in-memory storage
      if (global.inMemoryData && global.inMemoryData.familyGroups) {
        const allGroups = Array.from(global.inMemoryData.familyGroups.values());
        familyGroups = allGroups.filter(group => 
          group.createdBy === req.user.uid || 
          group.members.some(member => member.userId === req.user.uid && member.status === 'active')
        );
      }
    }

    res.json({
      success: true,
      familyGroups: familyGroups
    });

  } catch (error) {
    console.error('Get family groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family groups'
    });
  }
});

// Get family group details
router.get('/:groupId', authenticateUser, async (req, res) => {
  try {
    const familyGroup = await FamilyGroup.findById(req.params.groupId);

    if (!familyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Family group not found'
      });
    }

    // Check if user is a member
    if (!familyGroup.isMember(req.user.uid)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      familyGroup: familyGroup
    });

  } catch (error) {
    console.error('Get family group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family group'
    });
  }
});

// Update family group
router.put('/:groupId', authenticateUser, async (req, res) => {
  try {
    const familyGroup = await FamilyGroup.findById(req.params.groupId);

    if (!familyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Family group not found'
      });
    }

    // Check if user is admin
    if (!familyGroup.isAdmin(req.user.uid)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update family group settings'
      });
    }

    const { name, description, settings } = req.body;

    if (name) familyGroup.name = name.trim();
    if (description !== undefined) familyGroup.description = description.trim();
    
    if (settings) {
      if (settings.allowMemberInvites !== undefined) {
        familyGroup.settings.allowMemberInvites = settings.allowMemberInvites;
      }
      if (settings.autoAcceptInvites !== undefined) {
        familyGroup.settings.autoAcceptInvites = settings.autoAcceptInvites;
      }
      if (settings.defaultMemberRole) {
        familyGroup.settings.defaultMemberRole = settings.defaultMemberRole;
      }
      if (settings.maxMembers) {
        familyGroup.settings.maxMembers = Math.min(settings.maxMembers, 50);
      }
    }

    await familyGroup.save();

    res.json({
      success: true,
      message: 'Family group updated successfully',
      familyGroup: familyGroup
    });

  } catch (error) {
    console.error('Update family group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update family group'
    });
  }
});

// Invite member to family group
router.post('/:groupId/invite', authenticateUser, async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required'
      });
    }

    let familyGroup = null;
    
    // Try MongoDB first, fallback to in-memory
    try {
      familyGroup = await FamilyGroup.findById(req.params.groupId);
    } catch (mongoError) {
      console.warn('MongoDB findById failed, checking in-memory storage:', mongoError.message);
      
      // Check in-memory storage
      if (global.inMemoryData && global.inMemoryData.familyGroups) {
        familyGroup = global.inMemoryData.familyGroups.get(req.params.groupId);
      }
    }

    if (!familyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Family group not found'
      });
    }

    // Check permissions - handle both MongoDB and in-memory objects
    let userRole = null;
    if (familyGroup.getMemberRole) {
      userRole = familyGroup.getMemberRole(req.user.uid);
    } else {
      // For in-memory objects, check manually
      const member = familyGroup.members?.find(m => m.userId === req.user.uid && m.status === 'active');
      userRole = member ? member.role : null;
    }
    
    if (!userRole) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this family group'
      });
    }

    if (userRole !== 'admin' && !familyGroup.settings?.allowMemberInvites) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can send invitations'
      });
    }

    // Check if email is already a member
    const existingMember = familyGroup.members.find(m => 
      m.email.toLowerCase() === email.toLowerCase() && m.status === 'active'
    );

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this family group'
      });
    }

    // Check if there's already a pending invitation
    const existingInvitation = familyGroup.invitations?.find(inv => 
      inv.email.toLowerCase() === email.toLowerCase() && 
      inv.status === 'pending'
    );

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        message: 'Invitation already sent to this email'
      });
    }

    // Check member limit
    const memberCount = familyGroup.activeMembersCount || familyGroup.members?.filter(m => m.status === 'active').length || 0;
    const maxMembers = familyGroup.settings?.maxMembers || 10;
    
    if (memberCount >= maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Family group has reached maximum member limit'
      });
    }

    // Get inviter info
    const inviterRecord = await admin.auth().getUser(req.user.uid);
    
    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');

    // Create invitation
    const invitation = {
      email: email.toLowerCase(),
      invitedBy: req.user.uid,
      invitedByName: inviterRecord.displayName || inviterRecord.email,
      role: role || familyGroup.settings?.defaultMemberRole || 'member',
      invitationToken: invitationToken,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    // Initialize invitations array if it doesn't exist
    if (!familyGroup.invitations) {
      familyGroup.invitations = [];
    }
    
    familyGroup.invitations.push(invitation);
    
    // Save to MongoDB or in-memory storage
    try {
      if (familyGroup.save) {
        await familyGroup.save();
      } else {
        // Update in-memory storage
        global.inMemoryData.familyGroups.set(req.params.groupId, familyGroup);
      }
    } catch (saveError) {
      console.warn('Failed to save to MongoDB, updating in-memory storage:', saveError.message);
      global.inMemoryData = global.inMemoryData || { familyGroups: new Map() };
      global.inMemoryData.familyGroups.set(req.params.groupId, familyGroup);
    }

    // Send email invitation
    try {
      await emailService.sendFamilyInvitation({
        recipientEmail: email,
        recipientName: email.split('@')[0], // Use email prefix as name fallback
        familyGroupName: familyGroup.name,
        familyGroupDescription: familyGroup.description,
        inviterName: inviterRecord.displayName || inviterRecord.email,
        inviterEmail: inviterRecord.email,
        role: invitation.role,
        invitationToken: invitationToken,
        expiresAt: invitation.expiresAt
      });
      console.log(`Email invitation sent to ${email} for family group ${familyGroup.name}`);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Continue even if email fails - invitation is still created
    }

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      invitation: {
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedByName,
        invitationToken: invitation.invitationToken
      }
    });

  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invitation'
    });
  }
});

// Legacy endpoint for invitation acceptance (backward compatibility)
router.post('/invitations/accept/:id', authenticateUser, async (req, res) => {
  // Redirect to token-based endpoint
  return res.status(404).json({
    success: false,
    message: 'This endpoint is deprecated. Please use token-based acceptance.'
  });
});

// Reject invitation
router.post('/reject-invitation/:token', authenticateUser, async (req, res) => {
  try {
    const familyGroup = await FamilyGroup.findOne({
      'invitations.invitationToken': req.params.token,
      'invitations.status': INVITATION_STATUS.PENDING
    });

    if (!familyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    const invitation = familyGroup.invitations.find(inv => 
      inv.invitationToken === req.params.token
    );

    // Update invitation status
    invitation.status = INVITATION_STATUS.DECLINED;
    invitation.declinedAt = new Date();
    
    await familyGroup.save();

    res.json({
      success: true,
      message: 'Invitation declined successfully'
    });

  } catch (error) {
    console.error('Reject invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline invitation'
    });
  }
});

// Accept invitation
router.post('/accept-invitation/:token', authenticateUser, async (req, res) => {
  try {
    const familyGroup = await FamilyGroup.findOne({
      'invitations.invitationToken': req.params.token,
      'invitations.status': INVITATION_STATUS.PENDING
    });

    if (!familyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    const invitation = familyGroup.invitations.find(inv => 
      inv.invitationToken === req.params.token
    );

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      invitation.status = INVITATION_STATUS.EXPIRED;
      await familyGroup.save();
      
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired'
      });
    }

    // Get user info
    const userRecord = await admin.auth().getUser(req.user.uid);

    // Check if email matches
    if (userRecord.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation email does not match your account'
      });
    }

    // Add member to family group
    try {
      familyGroup.addMember({
        userId: req.user.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || userRecord.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy
      });

      // Update invitation status
      invitation.status = INVITATION_STATUS.ACCEPTED;
      invitation.acceptedAt = new Date();

      await familyGroup.save();

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail({
          email: userRecord.email,
          name: userRecord.displayName || userRecord.email,
          familyGroupName: familyGroup.name,
          role: invitation.role
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Continue even if email fails
      }

      res.json({
        success: true,
        message: 'Successfully joined family group',
        familyGroup: {
          _id: familyGroup._id,
          name: familyGroup.name,
          description: familyGroup.description,
          role: invitation.role
        }
      });

    } catch (memberError) {
      return res.status(400).json({
        success: false,
        message: memberError.message
      });
    }

  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation'
    });
  }
});

// Reject invitation
router.post('/reject-invitation/:token', authenticateUser, async (req, res) => {
  try {
    const familyGroup = await FamilyGroup.findOne({
      'invitations.invitationToken': req.params.token,
      'invitations.status': INVITATION_STATUS.PENDING
    });

    if (!familyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    const invitation = familyGroup.invitations.find(inv => 
      inv.invitationToken === req.params.token
    );

    // Get user info
    const userRecord = await admin.auth().getUser(req.user.uid);

    // Check if email matches
    if (userRecord.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation email does not match your account'
      });
    }

    // Update invitation status
    invitation.status = INVITATION_STATUS.REJECTED;
    invitation.rejectedAt = new Date();

    await familyGroup.save();

    res.json({
      success: true,
      message: 'Invitation rejected'
    });

  } catch (error) {
    console.error('Reject invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject invitation'
    });
  }
});

// Remove member from family group
router.delete('/:groupId/members/:memberId', authenticateUser, async (req, res) => {
  try {
    const familyGroup = await FamilyGroup.findById(req.params.groupId);

    if (!familyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Family group not found'
      });
    }

    // Check if user is admin or removing themselves
    const isAdmin = familyGroup.isAdmin(req.user.uid);
    const isSelf = req.params.memberId === req.user.uid;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can remove other members'
      });
    }

    try {
      familyGroup.removeMember(req.params.memberId);
      await familyGroup.save();

      res.json({
        success: true,
        message: 'Member removed successfully'
      });

    } catch (removeError) {
      return res.status(400).json({
        success: false,
        message: removeError.message
      });
    }

  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member'
    });
  }
});

// Update member role
router.put('/:groupId/members/:memberId/role', authenticateUser, async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !Object.values(FAMILY_ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required'
      });
    }

    const familyGroup = await FamilyGroup.findById(req.params.groupId);

    if (!familyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Family group not found'
      });
    }

    // Check if user is admin
    if (!familyGroup.isAdmin(req.user.uid)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update member roles'
      });
    }

    try {
      const updatedMember = familyGroup.updateMemberRole(req.params.memberId, role);
      await familyGroup.save();

      res.json({
        success: true,
        message: 'Member role updated successfully',
        member: updatedMember
      });

    } catch (updateError) {
      return res.status(400).json({
        success: false,
        message: updateError.message
      });
    }

  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update member role'
    });
  }
});

// Get pending invitations for current user
router.get('/invitations/pending', authenticateUser, async (req, res) => {
  try {
    const userRecord = await admin.auth().getUser(req.user.uid);
    let pendingInvitations = [];
    
    // Try MongoDB first, fallback to in-memory
    try {
      const familyGroups = await FamilyGroup.find({
        'invitations.email': userRecord.email.toLowerCase(),
        'invitations.status': 'pending',
        'invitations.expiresAt': { $gt: new Date() }
      });

      familyGroups.forEach(group => {
        const userInvitations = group.invitations.filter(inv => 
          inv.email.toLowerCase() === userRecord.email.toLowerCase() &&
          inv.status === 'pending' &&
          inv.expiresAt > new Date()
        );
        
        userInvitations.forEach(inv => {
          pendingInvitations.push({
            invitationToken: inv.invitationToken,
            familyGroupId: group._id,
            familyGroupName: group.name,
            familyGroupDescription: group.description,
            role: inv.role,
            invitedBy: inv.invitedByName,
            createdAt: inv.createdAt,
            expiresAt: inv.expiresAt
          });
        });
      });
    } catch (mongoError) {
      console.warn('MongoDB query failed, checking in-memory storage:', mongoError.message);
      
      // Check in-memory storage
      if (global.inMemoryData && global.inMemoryData.familyGroups) {
        const allGroups = Array.from(global.inMemoryData.familyGroups.values());
        allGroups.forEach(group => {
          if (group.invitations) {
            const userInvitations = group.invitations.filter(inv => 
              inv.email.toLowerCase() === userRecord.email.toLowerCase() &&
              inv.status === 'pending' &&
              new Date(inv.expiresAt) > new Date()
            );
            
            userInvitations.forEach(inv => {
              pendingInvitations.push({
                invitationToken: inv.invitationToken,
                familyGroupId: group._id,
                familyGroupName: group.name,
                familyGroupDescription: group.description,
                role: inv.role,
                invitedBy: inv.invitedByName,
                createdAt: inv.createdAt,
                expiresAt: inv.expiresAt
              });
            });
          }
        });
      }
    }

    res.json({
      success: true,
      invitations: pendingInvitations
    });

  } catch (error) {
    console.error('Get pending invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending invitations'
    });
  }
});

// Delete family group
router.delete('/:groupId', authenticateUser, async (req, res) => {
  try {
    const familyGroup = await FamilyGroup.findById(req.params.groupId);

    if (!familyGroup) {
      return res.status(404).json({
        success: false,
        message: 'Family group not found'
      });
    }

    // Only creator can delete the family group
    if (familyGroup.createdBy !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can delete the family group'
      });
    }

    familyGroup.status = 'archived';
    await familyGroup.save();

    res.json({
      success: true,
      message: 'Family group deleted successfully'
    });

  } catch (error) {
    console.error('Delete family group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete family group'
    });
  }
});

// Legacy endpoints for backward compatibility with old frontend code
router.post('/invite', authenticateUser, async (req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Please create a family group first, then use /{groupId}/invite endpoint'
  });
});

router.get('/invitations', authenticateUser, async (req, res) => {
  // Redirect to pending invitations
  try {
    const userRecord = await admin.auth().getUser(req.user.uid);
    
    const familyGroups = await FamilyGroup.find({
      'invitations.email': userRecord.email.toLowerCase(),
      'invitations.status': INVITATION_STATUS.PENDING,
      'invitations.expiresAt': { $gt: new Date() }
    });

    const pendingInvitations = [];
    
    familyGroups.forEach(group => {
      const userInvitations = group.invitations.filter(inv => 
        inv.email.toLowerCase() === userRecord.email.toLowerCase() &&
        inv.status === INVITATION_STATUS.PENDING &&
        inv.expiresAt > new Date()
      );
      
      userInvitations.forEach(inv => {
        pendingInvitations.push({
          invitationToken: inv.invitationToken,
          familyGroupId: group._id,
          familyGroupName: group.name,
          familyGroupDescription: group.description,
          role: inv.role,
          invitedBy: inv.invitedByName,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt
        });
      });
    });

    res.json({
      success: true,
      invitations: pendingInvitations
    });

  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invitations'
    });
  }
});

router.get('/members', authenticateUser, async (req, res) => {
  // Redirect to my-groups
  try {
    const familyGroups = await FamilyGroup.find({
      $or: [
        { createdBy: req.user.uid },
        { 'members.userId': req.user.uid, 'members.status': 'active' }
      ],
      status: 'active'
    }).sort({ lastModified: -1 });

    res.json({
      success: true,
      familyGroups: familyGroups
    });

  } catch (error) {
    console.error('Get family members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family members'
    });
  }
});

module.exports = router;
