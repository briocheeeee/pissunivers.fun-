import { DataTypes } from 'sequelize';

import sequelize from './sequelize.js';

const ModAction = sequelize.define('ModAction', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },

  target: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },

  details: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function logModAction(muid, action, target = null, details = null) {
  try {
    await ModAction.create({
      muid,
      action,
      target,
      details,
    });
  } catch (err) {
    console.error(`Failed to log mod action: ${err.message}`);
  }
}

export async function getModActions(filters = {}) {
  const {
    action,
    muid,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 50,
  } = filters;

  const where = {};

  if (action) {
    where.action = action;
  }

  if (muid) {
    where.muid = muid;
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      where.createdAt[DataTypes.Op ? DataTypes.Op.gte : '$gte'] = new Date(fromDate);
    }
    if (toDate) {
      where.createdAt[DataTypes.Op ? DataTypes.Op.lte : '$lte'] = new Date(toDate);
    }
  }

  if (search) {
    const { Op } = await import('sequelize');
    where[Op.or] = [
      { target: { [Op.like]: `%${search}%` } },
      { details: { [Op.like]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows } = await ModAction.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    include: [{
      association: 'mod',
      attributes: ['id', 'name'],
    }],
  });

  return {
    total: count,
    page,
    totalPages: Math.ceil(count / limit),
    actions: rows.map((row) => ({
      id: row.id,
      action: row.action,
      target: row.target,
      details: row.details,
      createdAt: row.createdAt,
      mod: row.mod ? { id: row.mod.id, name: row.mod.name } : null,
    })),
  };
}

export async function getDistinctActions() {
  const actions = await ModAction.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('action')), 'action']],
    raw: true,
  });
  return actions.map((a) => a.action);
}

export async function getDistinctModerators() {
  const { Op } = await import('sequelize');
  const mods = await ModAction.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('muid')), 'muid']],
    where: {
      muid: { [Op.ne]: null },
    },
    raw: true,
    include: [{
      association: 'mod',
      attributes: ['id', 'name'],
    }],
  });

  const User = (await import('./User.js')).default;
  const modIds = mods.map((m) => m.muid).filter(Boolean);

  if (!modIds.length) return [];

  const users = await User.findAll({
    where: { id: modIds },
    attributes: ['id', 'name'],
    raw: true,
  });

  return users;
}

export default ModAction;
