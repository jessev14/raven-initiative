export const moduleName = "raven-initiative";

const actions = {
    "Fast Action": 4,
    "Standard Action": 6,
    "Cantrip": 8,
    "Spellcasting": 10,
    d12: 12,
};
const dice = [4, 6, 8, 10, 12];
const upgrade = {
    "Fast Action": 3,
    "Standard Action": 4,
    "Cantrip": 6,
    "Spellcasting": 8,
    d12: 10,
};
const dice_upgrade = [3, 4, 6, 8, 10];
const downgrade = {
    "Fast Action": 6,
    "Standard Action": 8,
    "Cantrip": 10,
    "Spellcasting": 12,
    d12: 14,
};
const dice_downgrade = [6, 8, 10, 12, 14];

export function getGrade(actor) {
    const gradeEffects = actor.effects.filter(e => e.changes[0]?.key === "raven-initiative-grade");
    if (!gradeEffects.length) return {actions, dice};

    const upgrades = gradeEffects.filter(e => e.changes[0].value === "1");
    const downgrades = gradeEffects.filter(e => e.changes[0].value === "-1");
    
    if (upgrades.length > downgrades.length) return { actions: upgrade, dice: dice_upgrade };
    else if (upgrades.length < downgrades.length) return {actions: downgrade, dice: dice_downgrade};
    else return {actions, dice};
}

export function getWeaponDie(item, inputDice) {
    const damagePart = item.system.damage.parts?.[0]?.[0];
    if (!damagePart) return null;

    for (const part of damagePart.split("+")) {
        for (let i = 0; i < dice.length; i++) {
            if (part.trim().includes(`d${dice[i]}`)) {
                return `${part.split("d")[0]}d${inputDice[i]}`;
            }
        }
    }

    return null;
}

export function processAdvantange(adv = 0) {
    let n = 1, k = "", vantage = "";

    if (adv !== 0) n = 2;

    if (adv === 1) {
        k = "kh";
        vantage = " | Disadvantage";
    } else if (adv === -1) {
        k = "kl";
        vantage = " | Advantage";
    }

    return { n, k, vantage };
}
