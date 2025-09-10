const mongoose = require('mongoose');

// Family member roles and permissions
const FAMILY_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer'
};

const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

const familyMemberSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  displayName: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: Object.values(FAMILY_ROLES),
    default: FAMILY_ROLES.MEMBER
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  invitedBy: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
});

const familyInvitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  invitedBy: {
    type: String,
    required: true
  },
  invitedByName: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: Object.values(FAMILY_ROLES),
    default: FAMILY_ROLES.MEMBER
  },
  status: {
    type: String,
    enum: Object.values(INVITATION_STATUS),
    default: INVITATION_STATUS.PENDING
  },
  invitationToken: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  acceptedAt: Date,
  rejectedAt: Date
});

const familyGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  members: [familyMemberSchema],
  invitations: [familyInvitationSchema],
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: false
    },
    autoAcceptInvites: {
      type: Boolean,
      default: false
    },
    defaultMemberRole: {
      type: String,
      enum: Object.values(FAMILY_ROLES),
      default: FAMILY_ROLES.MEMBER
    },
    maxMembers: {
      type: Number,
      default: 10,
      min: 2,
      max: 50
    }
  },
  statistics: {
    totalMembers: {
      type: Number,
      default: 1
    },
    totalDocuments: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for better performance
familyGroupSchema.index({ createdBy: 1, status: 1 });
familyGroupSchema.index({ 'members.userId': 1 });
familyGroupSchema.index({ 'members.email': 1 });
familyGroupSchema.index({ 'invitations.email': 1, 'invitations.status': 1 });
familyGroupSchema.index({ 'invitations.invitationToken': 1 });

// Virtual for active members count
familyGroupSchema.virtual('activeMembersCount').get(function() {
  return this.members.filter(member => member.status === 'active').length;
});

// Virtual for pending invitations count
familyGroupSchema.virtual('pendingInvitationsCount').get(function() {
  return this.invitations.filter(inv => inv.status === INVITATION_STATUS.PENDING).length;
});

// Method to check if user is admin
familyGroupSchema.methods.isAdmin = function(userId) {
  const member = this.members.find(m => m.userId === userId && m.status === 'active');
  return member && member.role === FAMILY_ROLES.ADMIN;
};

// Method to check if user is member
familyGroupSchema.methods.isMember = function(userId) {
  const member = this.members.find(m => m.userId === userId && m.status === 'active');
  return !!member;
};

// Method to get member role
familyGroupSchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(m => m.userId === userId && m.status === 'active');
  return member ? member.role : null;
};

// Method to add member
familyGroupSchema.methods.addMember = function(memberData) {
  // Check if user is already a member
  const existingMember = this.members.find(m => m.userId === memberData.userId);
  if (existingMember) {
    if (existingMember.status === 'inactive') {
      existingMember.status = 'active';
      existingMember.joinedAt = new Date();
      return existingMember;
    }
    throw new Error('User is already a member of this family group');
  }

  // Check member limit
  if (this.activeMembersCount >= this.settings.maxMembers) {
    throw new Error('Family group has reached maximum member limit');
  }

  this.members.push(memberData);
  this.statistics.totalMembers = this.activeMembersCount;
  this.statistics.lastActivity = new Date();
  this.lastModified = new Date();
  
  return this.members[this.members.length - 1];
};

// Method to remove member
familyGroupSchema.methods.removeMember = function(userId) {
  const memberIndex = this.members.findIndex(m => m.userId === userId);
  if (memberIndex === -1) {
    throw new Error('Member not found');
  }

  // Cannot remove the creator
  if (this.members[memberIndex].userId === this.createdBy) {
    throw new Error('Cannot remove the family group creator');
  }

  this.members[memberIndex].status = 'inactive';
  this.statistics.totalMembers = this.activeMembersCount;
  this.statistics.lastActivity = new Date();
  this.lastModified = new Date();
};

// Method to update member role
familyGroupSchema.methods.updateMemberRole = function(userId, newRole) {
  const member = this.members.find(m => m.userId === userId && m.status === 'active');
  if (!member) {
    throw new Error('Member not found');
  }

  // Cannot change creator's role
  if (member.userId === this.createdBy) {
    throw new Error('Cannot change the creator\'s role');
  }

  member.role = newRole;
  this.statistics.lastActivity = new Date();
  this.lastModified = new Date();
  
  return member;
};

// Pre-save middleware
familyGroupSchema.pre('save', function(next) {
  this.lastModified = new Date();
  this.statistics.totalMembers = this.activeMembersCount;
  next();
});

const FamilyGroup = mongoose.model('FamilyGroup', familyGroupSchema);

module.exports = {
  FamilyGroup,
  FAMILY_ROLES,
  INVITATION_STATUS
};
