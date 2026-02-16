export interface SurveyItem {
  name: string;
  image?: string;
}

/**
 * BIB(Balanced Incomplete Block) 디자인 기반으로
 * 각 항목이 최소 minExposure번 이상 노출되도록 세트를 생성
 */
export function generateSets(
  items: SurveyItem[],
  setSize: number,
  minExposure: number = 3
): SurveyItem[][] {
  const n = items.length;
  if (n <= setSize) {
    return [items];
  }

  // 필요한 총 세트 수 계산: 각 항목이 minExposure번 노출
  // 한 세트에 setSize개 항목이 있으므로, 총 노출 = 세트수 * setSize
  // 각 항목 최소 minExposure번 => 세트수 >= (n * minExposure) / setSize
  const totalSets = Math.ceil((n * minExposure) / setSize);

  const sets: SurveyItem[][] = [];
  const exposureCount = new Map<string, number>();
  items.forEach((item) => exposureCount.set(item.name, 0));

  for (let i = 0; i < totalSets; i++) {
    // 노출 횟수가 적은 항목 우선 선택
    const sorted = [...items].sort((a, b) => {
      const countA = exposureCount.get(a.name) || 0;
      const countB = exposureCount.get(b.name) || 0;
      if (countA !== countB) return countA - countB;
      return Math.random() - 0.5;
    });

    const set = sorted.slice(0, setSize);
    sets.push(set);

    set.forEach((item) => {
      exposureCount.set(item.name, (exposureCount.get(item.name) || 0) + 1);
    });
  }

  // 셔플
  for (let i = sets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sets[i], sets[j]] = [sets[j], sets[i]];
  }

  return sets;
}

/**
 * MaxDiff 점수 계산 (0~100 정규화)
 */
export function calculateScores(
  items: SurveyItem[],
  responses: {
    setBatch: string[];
    bestItem: string;
    worstItem: string;
  }[]
): {
  name: string;
  image?: string;
  bestCount: number;
  worstCount: number;
  exposureCount: number;
  rawScore: number;
  score: number;
}[] {
  const stats = new Map<
    string,
    { bestCount: number; worstCount: number; exposureCount: number }
  >();

  items.forEach((item) => {
    stats.set(item.name, { bestCount: 0, worstCount: 0, exposureCount: 0 });
  });

  responses.forEach((r) => {
    r.setBatch.forEach((itemName) => {
      const s = stats.get(itemName);
      if (s) s.exposureCount++;
    });
    const best = stats.get(r.bestItem);
    if (best) best.bestCount++;
    const worst = stats.get(r.worstItem);
    if (worst) worst.worstCount++;
  });

  const results = items.map((item) => {
    const s = stats.get(item.name) || {
      bestCount: 0,
      worstCount: 0,
      exposureCount: 0,
    };
    const rawScore =
      s.exposureCount > 0
        ? (s.bestCount - s.worstCount) / s.exposureCount
        : 0;
    return {
      name: item.name,
      image: item.image,
      ...s,
      rawScore,
      score: 0,
    };
  });

  // 0~100 정규화
  const rawScores = results.map((r) => r.rawScore);
  const minRaw = Math.min(...rawScores);
  const maxRaw = Math.max(...rawScores);
  const range = maxRaw - minRaw;

  results.forEach((r) => {
    r.score = range > 0 ? ((r.rawScore - minRaw) / range) * 100 : 50;
  });

  return results.sort((a, b) => b.score - a.score);
}
