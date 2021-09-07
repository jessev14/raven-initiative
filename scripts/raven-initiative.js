import { libWrapper } from "../lib/shim.js";
import { RavenInfoPanel } from "./RavenInfoPanel.js";
import { moduleName, getWeaponDie, getGrade, processAdvantange } from "./helpers.js";

Hooks.once("init", () => {
    console.log("raven-initiative | initializing");

    // Register game settings
    game.settings.register(moduleName, "equippedOnly", {
        name: "Only Display Equipped Weapons",
        hint: "",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register(moduleName, "displayDelay", {
        name: "Display Delay Status to All",
        hint: "Token owners will always be able to see Delay status",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(moduleName, "actionFlavor", {
        name: "Display Initiative Action as Flavor Text",
        hint: "",
        scope: "world",
        config: true,
        type: String,
        choices: {
            disabled: "Disabled",
            pc: "Player Characters only",
            all: "Player Characters and NPCs"
        },
        default: "disabled"
    });

    game.settings.register(moduleName, "batchMode", {
        name: "Weapon Attack Batch Mode",
        hint: "If enabled, weapon attack initiative rolls with advantage or disadvantage will be rolled in batches.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });
});

Hooks.once("setup", () => {
    // Reverse initiative sorting, with ties won by higher DEX score
    libWrapper.register(moduleName, "Combat.prototype._sortCombatants", reverseInit, "OVERRIDE");

    // Replace roll initiative button with opening Select Actions dialog
    libWrapper.register(moduleName, "Combat.prototype.rollInitiative", ravenInitiative, "OVERRIDE");

    // Replace RollAll with rolling Default Initiative Action for NPCs
    libWrapper.register(moduleName, "Combat.prototype.rollAll", ravenRollNPC, "OVERRIDE");

    // Roll NPCs combat control button now opens DM Initiative Info Panel
    libWrapper.register(moduleName, "Combat.prototype.rollNPC", ravenInfoPanel, "OVERRIDE");

    // Reset All button also resets current action and delay
    libWrapper.register(moduleName, "Combat.prototype.resetAll", ravenReset, "WRAPPER");

    // Replace dnd5e actor sheet initiative roll with opening Select Actions dialog
    libWrapper.register(moduleName, "CONFIG.Actor.documentClass.prototype.rollInitiative", ravenInitiativeActor, "WRAPPER");
});


Hooks.on("getCombatTrackerEntryContext", (html, options) => {
    // Change Re-roll Initiative option name to "Change Action"
    const reroll = options.find(o => o.name === "COMBAT.CombatantReroll");
    reroll.name = "Change Action";
    reroll.icon = '<i class="fas fa-exchange-alt"></i>';
    reroll.condition = li => {
        const combatant = game.combats.viewed.combatants.get(li.data("combatant-id"));
        return Number.isNumeric(combatant.initiative)
    }

    // For NPCs Add option to roll default action
    const rollDefault = {
        name: "Roll Default Action",
        icon: '<i class="fas fa-dice-d20"></i>',
        condition: li => {
            const combatant = game.combats.viewed.combatants.get(li.data("combatant-id"));
            return (!Number.isNumeric(combatant.initiative));
        },
        callback: li => {
            const combatant = game.combats.viewed.combatants.get(li.data("combatant-id"));

            new Dialog({
                title: `Default Action - ${combatant.name}`,
                content: ``,
                buttons: {
                    advantange: {
                        label: "Advantage",
                        callback: html => rollDefaultAction(combatant, -1)
                    },
                    normal: {
                        label: "Normal",
                        callback: html => rollDefaultAction(combatant, 0)
                    },
                    disadvantage: {
                        label: "Disadvantage",
                        callback: html => rollDefaultAction(combatant, 1)
                    }
                },
                default: "normal"
            }).render(true);
        }
    }

    options.splice(-2, 0, rollDefault);
});

Hooks.on("updateCombat", (combat, diff, options, userID) => {
    // When a new round starts, reset initiative and flags
    if (diff.round > 1) combat.resetAll();
});

Hooks.on("renderCombatTracker", (app, html, appData) => {
    html.find('a[data-control="rollAll"]').prop("title", "Roll Default Action for NPCs");
    html.find('a[data-control="rollNPC"]').prop("title", "Initiative Info Panel");

    html.find("li.combatant").each(function () {
        // Add Delay control button
        const combatant = app.viewed.combatants.get($(this).data("combatant-id"));
        const delayFlag = combatant.getFlag(moduleName, "delay") ?? false;
        const active = delayFlag ? "active" : "";
        if (
            (game.settings.get(moduleName, "displayDelay") && delayFlag)
            || combatant.isOwner
        ) {
            $(this).find("div.combatant-controls").prepend(`
                <a class="combatant-control ${active}" title="Delay" name="raven-initiative-delay">
                    <i class="fas fa-history"></i></a>
            `);

            if (!combatant.isOwner) {
                $(this).find(`a[name="raven-initiative-delay"]`).css("pointer-events", "none");
            }
        }

        if (!combatant.isOwner) return;

        $(this).find(`a[name="raven-initiative-delay"]`).click(function (event) {
            event.stopPropagation();
            combatant.setFlag(moduleName, "delay", !delayFlag);
        });

        // Clicking initiative number also opens Select Action dialog
        $(this).find("div.token-initiative").click(event => {
            event.stopPropagation();
            app.viewed.rollInitiative([combatant.id]);
        });
    });

    if (!game.user.isGM) {
        // Add Change Action context menu options for players
        const entryOptions = app._getEntryContextOptions();
        const reroll = entryOptions.find(o => o.name === "COMBAT.CombatantReroll");
        reroll.name = "Change Action";
        reroll.condition = li => {
            const combatant = app.viewed.combatantas.get(li.data("combatant-id"));
            return combatant.isOwner && Number.isNumeric(combatant.initiative);
        };
        reroll.icon = '<i class="fas fa-exchange-alt"></i>';

        new ContextMenu(html, ".directory-item", [reroll]);
    }

    ui.raven?.render();
});

Hooks.on("renderTokenConfig", async (app, html, appData) => {
    if (app.actor.data.type !== "npc") return;

    // Inject Default Initiative Action for NPCs
    const equipSetting = game.settings.get(moduleName, "equippedOnly");
    const weapons = app.token.actor.items.contents.filter(i => {
        if (i.data.type !== "weapon") return false;

        if (equipSetting) return i.data.data.equipped;
        return true;
    });
    const { dice } = getGrade(app.actor);
    for (let i = 0; i < weapons.length; i++) {
        weapons[i].d = getWeaponDie(weapons[i], dice);
    }
    const defaultAction = app.token.getFlag(moduleName, "defaultAction") ?? "Standard Action";
    const defaultActionHTML = await renderTemplate("modules/raven-initiative/templates/defaultAction.hbs", { weapons, defaultAction });
    await html.find(`.tab[data-tab="character"`).append(defaultActionHTML);
    await html.css("height", "auto");
});

// Initiative Count
function reverseInit(a, b) {
    const ia = Number.isNumeric(a.initiative) ? a.initiative : null;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : null;

    // If combatants do not have initiatives, sort by name alphabetically
    if (ia === null || ib === null) {
        const cn = a.name.localeCompare(b.name);
        if (cn) return cn;
    }

    const aActor = a.actor || a.token.actor;
    const bActor = b.actor || b.token.actor;

    // If combatants do have initiatives, but they are equal (ci = 0), then break tie with DEX score
    const ci = ia - ib;
    if (ci) return ci;
    //const cd = b.actor.data.data.abilities.dex.value - a.actor.data.data.abilities.dex.value;
    const cd = bActor.data.data.abilities.dex.value - aActor.data.data.abilities.dex.value;
    if (cd) return cd;

    // If DEX score still tied (cd = 0), compare init upgrade/downgrade
    //const ga = a.actor.effects.find(e => e.data.changes[0]?.key === "raven-initiative-grade")?.data.changes[0]?.value || 0;
    const ga = aActor.effects.find(e => e.data.changes[0]?.key === "raven-initiative-grade")?.data.changes[0]?.value || 0;
    //const gb = b.actor.effects.find(e => e.data.changes[0]?.key === "raven-initiative-grade")?.data.changes[0]?.value || 0;
    const gb = bActor.effects.find(e => e.data.changes[0]?.key === "raven-initiative-grade")?.data.changes[0]?.value || 0;

    if (ga > gb) return -1;
    if (ga < gb) return 1;

    // If all else fails, sort by combatant id
    return a.id - b.id;
}

// Initiative Dice
async function ravenInitiative(combatantIDs) {
    for (const ID of combatantIDs) {
        const combatant = game.combats.viewed.combatants.get(ID);
        const { actions, dice } = getGrade(combatant.actor);

        const equipSetting = game.settings.get(moduleName, "equippedOnly");
        const weapons = combatant.actor.items.filter(i => {
            if (i.data.type !== "weapon") return false;

            if (equipSetting) return i.data.data.equipped;
            return true;
        });
        let weaponOptions = ``;
        for (const weapon of weapons) {
            const weaponDie = getWeaponDie(weapon, dice);
            if (weaponDie) weaponOptions += `<option value="${weapon.id}">${weapon.name} (${weaponDie})</option>`;
        }

        const rollModes = CONFIG.Dice.rollModes;
        const defaultRollMode = game.settings.get("core", "rollMode");
        const content = await renderTemplate("modules/raven-initiative/templates/selectAction.hbs", {
            weaponOptions,
            rollModes,
            defaultRollMode,
            dice
        });
        new Dialog({
            title: `Select Action - ${combatant.name}`,
            content,
            buttons: {
                advantange: {
                    label: "Advantage",
                    callback: html => processActions(html, -1)
                },
                normal: {
                    label: "Normal",
                    callback: html => processActions(html, 0)
                },
                disadvantage: {
                    label: "Disadvantage",
                    callback: html => processActions(html, 1)
                }
            },
            default: "normal"
        }).render(true);

        async function processActions(html, adv) {
            const { n, k, vantage } = processAdvantange(adv);

            const selectedAction = html.find('input[name="action"]:checked').val();
            if (!selectedAction) return;

            const weapon = combatant.actor.items.get(html.find(`select[name="weapon-select"]`).val());

            let formula = ``;

            if (selectedAction === "weapon") {
                if (game.settings.get(moduleName, "batchMode")) {
                    const weaponDie = getWeaponDie(weapon, dice);
                    const num = parseInt(weaponDie.split("d")[0]);
                    const die = parseInt(weaponDie.split("d")[1]);
                    formula += `{`;
                    for (let i = 0; i < num; i++) {
                        formula += `2d${die}${k}, `
                    }
                    formula += `}`;
                } else {
                    formula = getWeaponDie(weapon, dice);
                    if (adv === -1) formula = `{${formula}, ${formula}}kl`;
                    else if (adv === 1) formula = `{${formula}, ${formula}}kh`;
                }
            }
            else if (selectedAction === "weapon-alt") formula = html.find('input[name="weapon-alt"]').val();
            else formula = `${n}d${actions[selectedAction]}${k}`;

            const bonus = html.find('input[name="bonus"]').val().trim();
            if (bonus) {
                if (bonus[0] === "+" || bonus[0] === "-") formula += bonus;
                else formula += ` + ${bonus}`;
            }

            if (!formula) return;

            if (formula[0] === "+") formula = formula.slice(1);

            let flavor = `Initative - `
            if (selectedAction === "weapon") flavor += weapon.name;
            else if (selectedAction === "weapon-alt") flavor += "Weapon Attack";
            else flavor += selectedAction;
            flavor += vantage;
            const initRoll = await new Roll(formula).roll();
            let initiative = initRoll.total;
            const messageData = {
                speaker: ChatMessage.getSpeaker({ token: combatant.token.object })
            };
            const flavorSetting = game.settings.get(moduleName, "actionFlavor");
            if (
                (flavorSetting === "pc" && combatant.actor.type === "character")
                || flavorSetting === "all") {
                messageData.flavor = flavor;
            }
            await initRoll.toMessage(messageData, { rollMode: html.find(`select[name="rollMode"]`).val() });

            // If combatant already has an initiative, add new total to previous initiative
            if (Number.isNumeric(combatant.initiative)) initiative += combatant.initiative;
            await combatant.update({ initiative });

            // If combatant is an NPC, update current action flag
            if (combatant.actor.type === "npc") {
                let currentAction = selectedAction;
                if (selectedAction === "weapon") currentAction = weapon.id;
                else if (selectedAction === "weapon-alt") currentAction = formula;
                await combatant.setFlag(moduleName, "currentAction", currentAction);
            }
        }
    }
}

function ravenInitiativeActor(wrapped, { createCombatants, rerollInitiative, initiativeOptions }) {
    // Whenever actor roll initiative is called, always "reroll" initiative ("Change Action")
    return wrapped({ createCombatants, rerollInitiative: true, initiativeOptions });
}

async function ravenRollNPC() {
    const adv = event.ctrlKey ?
        1
        : event.altKey ?
            -1
            : 0;
    const npcCombatants = this.combatants.filter(c => c.isOwner && c.actor.type === "npc" && !c.initiative);
    for (const combatant of npcCombatants) {
        await rollDefaultAction(combatant, adv);
    }
}

async function ravenReset(wrapper) {
    for (const c of this.combatants) {
        c.data.update({ "flags.raven-initiative.currentAction": null, "flags.raven-initiative.delay": false });
    }

    wrapper();
}

function ravenInfoPanel() {
    ui.raven = new RavenInfoPanel().render(true);
}

async function rollDefaultAction(combatant, adv) {
    const { n, k, vantage } = processAdvantange(adv);
    const { actions, dice } = getGrade(combatant.actor);

    const defaultAction = combatant.token.getFlag(moduleName, "defaultAction") ?? "Standard Action";
    const weapon = combatant.actor.items.get(defaultAction);

    let flavor = `Initiative - `;
    if (weapon) flavor += weapon.name;
    else flavor += defaultAction;
    flavor += vantage;

    let formula = ``;
    if (Object.keys(actions).includes(defaultAction)) formula = `${n}d${actions[defaultAction]}${k}`;
    //else if (weapon) formula = `${n}d${getWeaponDie(weapon, dice)}${k}`;
    else if (weapon) {
        if (game.settings.get(moduleName, "batchMode")) {
            const weaponDie = getWeaponDie(weapon, dice);
            const num = parseInt(weaponDie.split("d")[0]);
            const die = parseInt(weaponDie.split("d")[1]);
            formula += `{`;
            for (let i = 0; i < num; i++) {
                formula += `2d${die}${k}, `
            }
            formula += `}`;
        } else {
            formula = getWeaponDie(weapon, dice);
            if (adv === -1) formula = `{${formula}, ${formula}}kl`;
            else if (adv === 1) formula = `{${formula}, ${formula}}kh`;
        }
    }

    if (!formula) return;

    const initRoll = await new Roll(formula).roll();
    const initiative = initRoll.total;
    const messageData = {
        speaker: ChatMessage.getSpeaker({ token: combatant.token.object })
    };
    if (game.settings.get(moduleName, "actionFlavor") === "all") messageData.flavor = flavor;
    await initRoll.toMessage(messageData, { rollMode: game.settings.get("core", "rollMode") });
    await combatant.update({ initiative });
    await combatant.setFlag(moduleName, "currentAction", defaultAction);
}
