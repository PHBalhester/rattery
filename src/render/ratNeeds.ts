import {tr} from '../i18n';
import {playActivity} from '../sim/playActivity';
import type {CareAction} from '../sim/care';
import type {World} from '../types';

type Rat = World['rats'][string];

export type RatNeed = {key: string; label: string; hint: string; actions: CareAction[]; critical: boolean};

/** Plain-language needs for one rat, most urgent first. Presentation only; never feeds the simulation. */
export function ratNeeds(rat: Rat): RatNeed[] {
  if (rat.deadAt !== null) return [];
  const needs: RatNeed[] = [];
  const hydration = rat.wellbeing?.hydration ?? 1;
  const stress = rat.wellbeing?.acute ?? 0;
  const lonely = rat.wellbeing?.isolationDistress ?? 0;
  const injury = rat.injury ?? 0;
  if (hydration < .45) needs.push({key: 'thirst', label: tr('Thirsty', '口渴'), hint: tr('Offer water', '提供饮水'), actions: ['water'], critical: hydration < .25});
  if (rat.energy < .45) needs.push({key: 'hunger', label: tr('Low energy', '能量不足'), hint: tr('Feed or offer a treat', '喂食或提供零食'), actions: ['feed', 'treat'], critical: rat.energy < .25});
  if (injury > .3) needs.push({key: 'injury', label: tr('Injured', '受伤'), hint: tr('Let it rest; avoid play', '让它休息，避免玩耍'), actions: [], critical: injury > .6});
  if (stress > .45) needs.push({key: 'stress', label: tr('Stressed', '压力大'), hint: tr('Gentle petting calms it', '温柔抚摸可以安抚'), actions: ['pet'], critical: stress > .75});
  if (lonely > .45) needs.push({key: 'lonely', label: tr('Lonely', '孤独'), hint: tr('Play or invite to explore', '玩耍或邀请探索'), actions: ['play', 'explore'], critical: lonely > .75});
  return needs.sort((a, b) => Number(b.critical) - Number(a.critical));
}

const actionLabels: Record<string, [string, string]> = {wheel: ['Running in the wheel', '跑轮运动'], digging: ['Digging', '挖掘'], ball: ['Playing with a ball', '玩球'], chewing: ['Gnawing', '啃咬'], foraging: ['Foraging', '觅食'], courtship: ['Courtship', '求偶'], mating: ['Mating', '交配'], fight: ['Fighting', '争斗'], groom: ['Social grooming', '社交梳理']};

/** What the rat is doing right now, in words. */
export function ratActivity(rat: Rat): string {
  if (rat.deadAt !== null) return tr('Deceased', '已故');
  const current = actionLabels[rat.socialAction?.kind ?? playActivity.get(rat.id)?.kind ?? ''];
  if (current) return tr(...current);
  if (rat.exploration?.den !== undefined) return tr('Visiting a shared den', '正在使用共享洞穴');
  if (Math.hypot(rat.vx, rat.vy) > .3) return tr('Exploring', '探索中');
  if (rat.inNest) return tr('In the nest', '在巢内');
  return tr('Resting', '休息中');
}
