import { QueryTypes } from 'sequelize';
import sequelize from '../data/sql/sequelize.js';
import {
  getCurrentWeek,
  getWeekById,
  updateWeekStatus,
  TOTW_CATEGORY,
  TOTW_AWARD_TYPE,
  FACTION_SIZE_THRESHOLDS,
} from '../data/sql/TOTWWeek.js';
import {
  addTOTWBadgeToFactionMembers,
  clearAllTOTWNomineeBadges,
  TOTW_BADGE_NAMES,
} from '../data/sql/TOTWBadge.js';
import socketEvents from '../socket/socketEvents.js';
import {
  getNomineesForWeek,
  createNominee,
  getFactionCategory,
  calculateCompositeScore,
  getRecentWinners,
  setWinner,
  updateNomineeVotes,
} from '../data/sql/TOTWNominee.js';
import { createWinner, getWinnersForWeek } from '../data/sql/TOTWWinner.js';
import { getVotesForWeek } from '../data/sql/TOTWVote.js';
import { getFactionRankings, getFactionRanks } from '../data/redis/factionRanks.js';

const NOMINEES_PER_CATEGORY = 5;
const ANTI_MONOPOLE_WEEKS = 3;

const SCORE_WEIGHTS = {
  PIXELS: 0.4,
  WIN_RATIO: 0.3,
  GROWTH: 0.3,
};

export async function calculateWeeklyScores() {
  const week = await getCurrentWeek();
  if (week.finalized) {
    return { error: 'Week already finalized' };
  }

  const recentWinners = await getRecentWinners(ANTI_MONOPOLE_WEEKS);

  const factions = await sequelize.query(
    `SELECT f.id, f.name, f.tag, f.avatar,
            (SELECT COUNT(*) FROM FactionMembers fm WHERE fm.fid = f.id) as memberCount
     FROM Factions f
     WHERE (SELECT COUNT(*) FROM FactionMembers fm WHERE fm.fid = f.id) >= 2`,
    { type: QueryTypes.SELECT },
  );

  const eligibleFactions = factions.filter((f) => !recentWinners.has(f.id));

  const factionScores = await Promise.all(
    eligibleFactions.map(async (faction) => {
      const [ranks, previousWeekPixels, winRatio, defeatedLarger] = await Promise.all([
        getFactionRanks(faction.id),
        getPreviousWeekPixels(faction.id),
        calculateWinRatio(faction.id),
        checkDefeatedLargerFaction(faction.id, faction.memberCount),
      ]);

      const category = getFactionCategory(faction.memberCount);
      const growthPercent = previousWeekPixels > 0
        ? ((ranks.dailyPixels - previousWeekPixels) / previousWeekPixels) * 100
        : (ranks.dailyPixels > 0 ? 100 : 0);

      const compositeScore = calculateCompositeScore(
        ranks.dailyPixels,
        faction.memberCount,
        growthPercent,
      );

      return {
        factionId: faction.id,
        name: faction.name,
        tag: faction.tag,
        avatar: faction.avatar,
        memberCount: faction.memberCount,
        category,
        pixelsCaptured: ranks.dailyPixels,
        winRatio,
        growthPercent,
        compositeScore,
        previousWeekPixels,
        defeatedLargerFaction: defeatedLarger,
      };
    }),
  );

  return { week, factionScores };
}

async function getPreviousWeekPixels(factionId) {
  const result = await sequelize.query(
    `SELECT pixelsCaptured FROM TOTWNominees tn
     JOIN TOTWWeeks tw ON tn.weekId = tw.id
     WHERE tn.factionId = ? AND tw.finalized = 1
     ORDER BY tw.year DESC, tw.weekNumber DESC
     LIMIT 1`,
    {
      replacements: [factionId],
      type: QueryTypes.SELECT,
    },
  );
  return result.length > 0 ? result[0].pixelsCaptured : 0;
}

async function calculateWinRatio(factionId) {
  return 0.5;
}

async function checkDefeatedLargerFaction(factionId, memberCount) {
  return false;
}

export async function generateNominees() {
  const { week, factionScores } = await calculateWeeklyScores();
  if (!factionScores) {
    return { error: 'Failed to calculate scores' };
  }

  const existingNominees = await getNomineesForWeek(week.id);
  if (existingNominees.length > 0) {
    await sequelize.query('DELETE FROM TOTWNominees WHERE weekId = ?', {
      replacements: [week.id],
      type: QueryTypes.DELETE,
    });
  }

  const nominees = {
    [TOTW_CATEGORY.SMALL]: [],
    [TOTW_CATEGORY.MEDIUM]: [],
    [TOTW_CATEGORY.LARGE]: [],
    mostImproved: null,
    underdog: null,
  };

  for (const category of [TOTW_CATEGORY.SMALL, TOTW_CATEGORY.MEDIUM, TOTW_CATEGORY.LARGE]) {
    const categoryFactions = factionScores
      .filter((f) => f.category === category)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, NOMINEES_PER_CATEGORY);

    for (const faction of categoryFactions) {
      const nominee = await createNominee({
        weekId: week.id,
        factionId: faction.factionId,
        category,
        awardType: TOTW_AWARD_TYPE.MAIN,
        pixelsCaptured: faction.pixelsCaptured,
        winRatio: faction.winRatio,
        growthPercent: faction.growthPercent,
        compositeScore: faction.compositeScore,
        memberCount: faction.memberCount,
        previousWeekPixels: faction.previousWeekPixels,
        defeatedLargerFaction: faction.defeatedLargerFaction,
      });
      nominees[category].push(nominee.get({ plain: true }));
    }
  }

  const mostImproved = factionScores
    .filter((f) => f.previousWeekPixels > 0)
    .sort((a, b) => b.growthPercent - a.growthPercent)[0];

  if (mostImproved) {
    const nominee = await createNominee({
      weekId: week.id,
      factionId: mostImproved.factionId,
      category: mostImproved.category,
      awardType: TOTW_AWARD_TYPE.MOST_IMPROVED,
      pixelsCaptured: mostImproved.pixelsCaptured,
      winRatio: mostImproved.winRatio,
      growthPercent: mostImproved.growthPercent,
      compositeScore: mostImproved.compositeScore,
      memberCount: mostImproved.memberCount,
      previousWeekPixels: mostImproved.previousWeekPixels,
      defeatedLargerFaction: mostImproved.defeatedLargerFaction,
    });
    nominees.mostImproved = nominee.get({ plain: true });
  }

  const underdog = factionScores
    .filter((f) => f.defeatedLargerFaction && f.category === TOTW_CATEGORY.SMALL)
    .sort((a, b) => b.compositeScore - a.compositeScore)[0];

  if (underdog) {
    const nominee = await createNominee({
      weekId: week.id,
      factionId: underdog.factionId,
      category: underdog.category,
      awardType: TOTW_AWARD_TYPE.UNDERDOG,
      pixelsCaptured: underdog.pixelsCaptured,
      winRatio: underdog.winRatio,
      growthPercent: underdog.growthPercent,
      compositeScore: underdog.compositeScore,
      memberCount: underdog.memberCount,
      previousWeekPixels: underdog.previousWeekPixels,
      defeatedLargerFaction: underdog.defeatedLargerFaction,
    });
    nominees.underdog = nominee.get({ plain: true });
  }

  const nominatedFactionIds = new Set();
  for (const category of [TOTW_CATEGORY.SMALL, TOTW_CATEGORY.MEDIUM, TOTW_CATEGORY.LARGE]) {
    for (const nominee of nominees[category]) {
      nominatedFactionIds.add(nominee.factionId);
    }
  }
  if (nominees.mostImproved) {
    nominatedFactionIds.add(nominees.mostImproved.factionId);
  }
  if (nominees.underdog) {
    nominatedFactionIds.add(nominees.underdog.factionId);
  }

  await clearAllTOTWNomineeBadges();

  for (const factionId of nominatedFactionIds) {
    await addTOTWBadgeToFactionMembers(factionId, TOTW_BADGE_NAMES.NOMINEE);
    await sendNominationNotification(factionId, week.weekNumber, week.year);
  }

  return { week, nominees };
}

async function sendNominationNotification(factionId, weekNumber, year) {
  try {
    const faction = await sequelize.query(
      'SELECT name, tag FROM Factions WHERE id = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!faction) return;

    const members = await sequelize.query(
      'SELECT uid FROM FactionMembers WHERE fid = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
      },
    );

    const message = `Your faction [${faction.tag}] ${faction.name} has been nominated for Team of the Week ${weekNumber}/${year}! Vote now!`;

    for (const member of members) {
      socketEvents.broadcastSUChatMessage(
        member.uid,
        'event',
        message,
        1,
        1,
        'xx',
      );
    }
  } catch (error) {
    console.error(`Error sending nomination notification: ${error.message}`);
  }
}

export async function openVoting(weekId) {
  await updateWeekStatus(weekId, { votingOpen: true });
}

export async function closeVotingAndDetermineWinners(weekId) {
  const week = await getWeekById(weekId);
  if (!week || week.finalized) {
    return { error: 'Invalid week or already finalized' };
  }

  await updateWeekStatus(weekId, { votingOpen: false });

  const votes = await getVotesForWeek(weekId);
  const voteMap = new Map(votes.map((v) => [v.nomineeId, v.voteCount]));

  const nominees = await getNomineesForWeek(weekId);
  for (const nominee of nominees) {
    const voteCount = voteMap.get(nominee.id) || 0;
    await updateNomineeVotes(nominee.id, voteCount);
  }

  const winners = [];

  for (const category of [TOTW_CATEGORY.SMALL, TOTW_CATEGORY.MEDIUM, TOTW_CATEGORY.LARGE]) {
    const categoryNominees = nominees
      .filter((n) => n.category === category && n.awardType === TOTW_AWARD_TYPE.MAIN)
      .sort((a, b) => b.compositeScore - a.compositeScore);

    if (categoryNominees.length > 0) {
      const winner = categoryNominees[0];
      await setWinner(winner.id);

      const winnerRecord = await createWinner({
        weekId,
        factionId: winner.factionId,
        nomineeId: winner.id,
        category,
        awardType: TOTW_AWARD_TYPE.MAIN,
        compositeScore: winner.compositeScore,
        pixelsCaptured: winner.pixelsCaptured,
        memberCount: winner.memberCount,
      });
      winners.push(winnerRecord.get({ plain: true }));
    }
  }

  const specialAwards = [
    TOTW_AWARD_TYPE.MOST_IMPROVED,
    TOTW_AWARD_TYPE.UNDERDOG,
  ];

  for (const awardType of specialAwards) {
    const specialNominees = nominees.filter((n) => n.awardType === awardType);
    if (specialNominees.length > 0) {
      const winner = specialNominees[0];
      await setWinner(winner.id);

      const winnerRecord = await createWinner({
        weekId,
        factionId: winner.factionId,
        nomineeId: winner.id,
        category: winner.category,
        awardType,
        compositeScore: winner.compositeScore,
        pixelsCaptured: winner.pixelsCaptured,
        memberCount: winner.memberCount,
      });
      winners.push(winnerRecord.get({ plain: true }));
    }
  }

  const communityNominees = nominees
    .filter((n) => n.awardType === TOTW_AWARD_TYPE.MAIN)
    .sort((a, b) => (voteMap.get(b.id) || 0) - (voteMap.get(a.id) || 0));

  if (communityNominees.length > 0 && (voteMap.get(communityNominees[0].id) || 0) > 0) {
    const communityWinner = communityNominees[0];

    const existingWinner = winners.find((w) => w.factionId === communityWinner.factionId);
    if (!existingWinner) {
      const winnerRecord = await createWinner({
        weekId,
        factionId: communityWinner.factionId,
        nomineeId: communityWinner.id,
        category: communityWinner.category,
        awardType: TOTW_AWARD_TYPE.COMMUNITY_CHOICE,
        compositeScore: communityWinner.compositeScore,
        pixelsCaptured: communityWinner.pixelsCaptured,
        memberCount: communityWinner.memberCount,
      });
      winners.push(winnerRecord.get({ plain: true }));
    }
  }

  await updateWeekStatus(weekId, { finalized: true });

  await clearAllTOTWNomineeBadges();

  for (const winner of winners) {
    await addTOTWBadgeToFactionMembers(winner.factionId, TOTW_BADGE_NAMES.WINNER);
    await sendWinnerNotification(winner.factionId, week.weekNumber, week.year, winner.awardType);
  }

  return { week, winners };
}

async function sendWinnerNotification(factionId, weekNumber, year, awardType) {
  try {
    const faction = await sequelize.query(
      'SELECT name, tag FROM Factions WHERE id = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!faction) return;

    const members = await sequelize.query(
      'SELECT uid FROM FactionMembers WHERE fid = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
      },
    );

    const awardName = AWARD_TYPE_NAMES[awardType] || 'Team of the Week';
    const message = `Congratulations! Your faction [${faction.tag}] ${faction.name} won ${awardName} for Week ${weekNumber}/${year}!`;

    for (const member of members) {
      socketEvents.broadcastSUChatMessage(
        member.uid,
        'event',
        message,
        1,
        1,
        'xx',
      );
    }
  } catch (error) {
    console.error(`Error sending winner notification: ${error.message}`);
  }
}

export async function getCurrentTOTWStatus() {
  const week = await getCurrentWeek();
  const nominees = await getNomineesForWeek(week.id);
  const winners = week.finalized ? await getWinnersForWeek(week.id) : [];

  const nomineesWithFactionInfo = await enrichNomineesWithFactionInfo(nominees);

  return {
    week,
    nominees: nomineesWithFactionInfo,
    winners,
    votingOpen: week.votingOpen,
    finalized: week.finalized,
  };
}

async function enrichNomineesWithFactionInfo(nominees) {
  if (nominees.length === 0) return [];

  const factionIds = [...new Set(nominees.map((n) => n.factionId))];
  const factions = await sequelize.query(
    'SELECT id, name, tag, avatar FROM Factions WHERE id IN (?)',
    {
      replacements: [factionIds],
      type: QueryTypes.SELECT,
    },
  );

  const factionMap = new Map(factions.map((f) => [f.id, f]));

  return nominees.map((n) => {
    const faction = factionMap.get(n.factionId) || {};
    return {
      ...n,
      factionName: faction.name,
      factionTag: faction.tag,
      factionAvatar: faction.avatar,
    };
  });
}

export const CATEGORY_NAMES = {
  [TOTW_CATEGORY.SMALL]: 'Small',
  [TOTW_CATEGORY.MEDIUM]: 'Medium',
  [TOTW_CATEGORY.LARGE]: 'Large',
};

export const AWARD_TYPE_NAMES = {
  [TOTW_AWARD_TYPE.MAIN]: 'Team of the Week',
  [TOTW_AWARD_TYPE.MOST_IMPROVED]: 'Most Improved',
  [TOTW_AWARD_TYPE.UNDERDOG]: 'Underdog of the Week',
  [TOTW_AWARD_TYPE.COMMUNITY_CHOICE]: 'Community Choice',
};
