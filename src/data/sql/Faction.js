import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

export const FACTION_ACCESS = {
  OPEN: 0,
  REQUEST: 1,
  CLOSED: 2,
};

export const FACTION_ROLE = {
  MEMBER: 0,
  OWNER: 1,
};

const Faction = sequelize.define('Faction', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    type: `${DataTypes.STRING(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    unique: 'name',
  },

  tag: {
    type: `${DataTypes.STRING(8)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    unique: 'tag',
  },

  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
  },

  access: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: FACTION_ACCESS.OPEN,
  },

  ownerId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
}, {
  timestamps: true,
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
});

export async function createFaction(name, tag, ownerId, access = FACTION_ACCESS.OPEN, avatar = null) {
  const transaction = await sequelize.transaction();
  try {
    const faction = await Faction.create({
      name,
      tag,
      ownerId,
      access,
      avatar,
    }, { transaction });

    await sequelize.query(
      'INSERT INTO FactionMembers (fid, uid, role, joinedAt) VALUES (?, ?, ?, NOW())',
      {
        replacements: [faction.id, ownerId, FACTION_ROLE.OWNER],
        type: QueryTypes.INSERT,
        transaction,
      },
    );

    await transaction.commit();
    return faction;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function getFactionById(factionId) {
  try {
    return await Faction.findByPk(factionId, { raw: true });
  } catch (error) {
    console.error(`SQL Error on getFactionById: ${error.message}`);
    return null;
  }
}

export async function getFactionByTag(tag) {
  try {
    return await Faction.findOne({
      where: { tag },
      raw: true,
    });
  } catch (error) {
    console.error(`SQL Error on getFactionByTag: ${error.message}`);
    return null;
  }
}

export async function getFactionByName(name) {
  try {
    return await Faction.findOne({
      where: { name },
      raw: true,
    });
  } catch (error) {
    console.error(`SQL Error on getFactionByName: ${error.message}`);
    return null;
  }
}

export async function updateFaction(factionId, updates) {
  try {
    await Faction.update(updates, { where: { id: factionId } });
    return true;
  } catch (error) {
    console.error(`SQL Error on updateFaction: ${error.message}`);
    return false;
  }
}

export async function deleteFaction(factionId) {
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(
      'DELETE FROM FactionRequests WHERE fid = ?',
      { replacements: [factionId], type: QueryTypes.DELETE, transaction },
    );
    await sequelize.query(
      'DELETE FROM FactionMembers WHERE fid = ?',
      { replacements: [factionId], type: QueryTypes.DELETE, transaction },
    );
    await Faction.destroy({ where: { id: factionId }, transaction });
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    console.error(`SQL Error on deleteFaction: ${error.message}`);
    return false;
  }
}

export async function getFactionWithStats(factionId) {
  try {
    const result = await sequelize.query(
      `SELECT f.*, 
        (SELECT COUNT(*) FROM FactionMembers fm WHERE fm.fid = f.id) AS memberCount
      FROM Factions f WHERE f.id = ?`,
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return result;
  } catch (error) {
    console.error(`SQL Error on getFactionWithStats: ${error.message}`);
    return null;
  }
}

export async function checkFactionNameExists(name, excludeId = null) {
  try {
    let query = 'SELECT id FROM Factions WHERE name = ?';
    const replacements = [name];
    if (excludeId) {
      query += ' AND id != ?';
      replacements.push(excludeId);
    }
    const result = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
      plain: true,
    });
    return !!result;
  } catch (error) {
    console.error(`SQL Error on checkFactionNameExists: ${error.message}`);
    return true;
  }
}

export async function checkFactionTagExists(tag, excludeId = null) {
  try {
    let query = 'SELECT id FROM Factions WHERE tag = ?';
    const replacements = [tag];
    if (excludeId) {
      query += ' AND id != ?';
      replacements.push(excludeId);
    }
    const result = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
      plain: true,
    });
    return !!result;
  } catch (error) {
    console.error(`SQL Error on checkFactionTagExists: ${error.message}`);
    return true;
  }
}

export default Faction;
