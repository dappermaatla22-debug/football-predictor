/* ============================================================
   PITCHLINE PREDICTION ENGINE
   Two parts:
   1. Elo Rating System  -> measures team strength over time
   2. Poisson Model       -> turns "expected goals" into win/draw/loss %
   ============================================================ */


/* ---------- 1. ELO RATING SYSTEM ---------- */

/**
 * Calculates the probability that Team A beats Team B based on Elo ratings.
 * This does NOT predict score - just relative strength.
 */
function eloWinProbability(ratingA, ratingB, homeAdvantage = 60) {
  // Home advantage is added as a rating bonus (industry standard ~50-100 points)
  const adjustedA = ratingA + homeAdvantage;
  const diff = adjustedA - ratingB;
  // Standard Elo logistic formula
  const probA = 1 / (1 + Math.pow(10, -diff / 400));
  return probA; // value between 0 and 1
}

/**
 * Updates Elo ratings after a match result.
 * result: 1 = Team A won, 0.5 = draw, 0 = Team A lost
 * kFactor: how much one match can swing a rating (20-32 is typical for football)
 */
function updateElo(ratingA, ratingB, result, kFactor = 24) {
  const expectedA = eloWinProbability(ratingA, ratingB, 0); // no home bonus for rating updates
  const newRatingA = ratingA + kFactor * (result - expectedA);
  const newRatingB = ratingB + kFactor * ((1 - result) - (1 - expectedA));
  return { newRatingA, newRatingB };
}


/* ---------- 2. POISSON GOAL MODEL ---------- */

/**
 * Poisson probability mass function:
 * "What's the chance a team scores EXACTLY k goals,
 *  given they average lambda goals per game?"
 */
function poissonProbability(lambda, k) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

/**
 * Estimates each team's "expected goals" (lambda) for this specific match,
 * using their attack/defense strength relative to the league average.
 *
 * avgLeagueGoals: average goals scored per team per game in the league (~1.4 in most top leagues)
 */
function expectedGoals(teamAttackStrength, opponentDefenseStrength, avgLeagueGoals) {
  return teamAttackStrength * opponentDefenseStrength * avgLeagueGoals;
}

/**
 * Team "attack strength"  = (team's avg goals scored)  / (league avg goals)
 * Team "defense strength" = (team's avg goals conceded) / (league avg goals)
 * A defense strength > 1 means they concede MORE than average (weaker defense).
 */
function calculateStrength(teamGoalsPerGame, leagueAvgGoals) {
  return teamGoalsPerGame / leagueAvgGoals;
}

/**
 * Builds a full scoreline probability matrix (e.g. 0-0, 1-0, 2-1, etc up to maxGoals each)
 * then sums it up into Home Win / Draw / Away Win percentages.
 */
function matchOutcomeProbabilities(homeLambda, awayLambda, maxGoals = 6) {
  let homeWin = 0, draw = 0, awayWin = 0;
  const scoreMatrix = [];

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonProbability(homeLambda, h) * poissonProbability(awayLambda, a);
      scoreMatrix.push({ home: h, away: a, probability: p });

      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
    }
  }

  // Find the single most likely exact scoreline (fun to display, not the main prediction)
  const mostLikelyScore = scoreMatrix.reduce((best, cur) =>
    cur.probability > best.probability ? cur : best
  );

  return {
    homeWinPct: Math.round(homeWin * 100),
    drawPct: Math.round(draw * 100),
    awayWinPct: Math.round(awayWin * 100),
    mostLikelyScore: `${mostLikelyScore.home}-${mostLikelyScore.away}`
  };
}


/* ---------- 3. COMBINE ELO + POISSON INTO ONE CONFIDENCE SCORE ---------- */

/**
 * Blends the Elo-based win probability with the Poisson-based win probability.
 * Why blend both?
 *  - Elo captures long-term team quality and consistency (slow-moving, reliable)
 *  - Poisson captures current scoring form (reacts faster, more sensitive to recent games)
 * Averaging them is a simple, defensible way to reduce the risk of either model overreacting.
 */
function blendedPrediction(eloProbHomeWin, poissonResult, eloWeight = 0.5) {
  const poissonWeight = 1 - eloWeight;

  const blendedHomeWin = (eloProbHomeWin * eloWeight) + (poissonResult.homeWinPct / 100 * poissonWeight);

  return {
    confidence: Math.round(blendedHomeWin * 100),
    homeWinPct: poissonResult.homeWinPct,
    drawPct: poissonResult.drawPct,
    awayWinPct: poissonResult.awayWinPct,
    mostLikelyScore: poissonResult.mostLikelyScore
  };
}


/* ============================================================
   EXAMPLE: Arsenal vs Chelsea
   ============================================================ */

// Made-up but realistic example stats - we'll replace these with REAL API data next
const exampleMatch = {
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  homeElo: 1920,
  awayElo: 1840,
  homeGoalsPerGame: 2.1,   // Arsenal's average goals scored per game this season
  awayGoalsConcededPerGame: 1.3, // Chelsea's average goals conceded per game
  awayGoalsPerGame: 1.5,
  homeGoalsConcededPerGame: 1.1,
  leagueAvgGoals: 1.4
};

// Step A: Elo probability
const eloProb = eloWinProbability(exampleMatch.homeElo, exampleMatch.awayElo);

// Step B: Expected goals using attack/defense strength
const homeAttack = calculateStrength(exampleMatch.homeGoalsPerGame, exampleMatch.leagueAvgGoals);
const awayDefense = calculateStrength(exampleMatch.awayGoalsConcededPerGame, exampleMatch.leagueAvgGoals);
const awayAttack = calculateStrength(exampleMatch.awayGoalsPerGame, exampleMatch.leagueAvgGoals);
const homeDefense = calculateStrength(exampleMatch.homeGoalsConcededPerGame, exampleMatch.leagueAvgGoals);

const homeLambda = expectedGoals(homeAttack, awayDefense, exampleMatch.leagueAvgGoals);
const awayLambda = expectedGoals(awayAttack, homeDefense, exampleMatch.leagueAvgGoals);

// Step C: Poisson outcome probabilities
const poissonResult = matchOutcomeProbabilities(homeLambda, awayLambda);

// Step D: Blend into final confidence
const finalPrediction = blendedPrediction(eloProb, poissonResult);

console.log(`${exampleMatch.homeTeam} vs ${exampleMatch.awayTeam}`);
console.log(`Home win: ${finalPrediction.homeWinPct}% | Draw: ${finalPrediction.drawPct}% | Away win: ${finalPrediction.awayWinPct}%`);
console.log(`Most likely scoreline: ${finalPrediction.mostLikelyScore}`);
console.log(`Blended confidence (home win): ${finalPrediction.confidence}%`);