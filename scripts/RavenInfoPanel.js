import { moduleName, getGrade, getWeaponDie } from "./helpers.js";

export class RavenInfoPanel extends Application {
    constructor() {
        super();
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["app", "window-app", "sidebar-popout", "directory"],
            popOut: true,
            template: "modules/raven-initiative/templates/raven-info-panel.hbs",
            title: "Initiative Info Panel",
            width: 350,
            height: 350,
            top: $(document).find("#sidebar").prop("offsetTop"),
            left: $(document).find("#sidebar").prop("offsetLeft") - $(document).find("#sidebar").prop("offsetWidth") - 60,
            scrollY: [".directory-list"]
        });
    }

    async getData() {
        const data = await CombatTracker.prototype.getData.call(ui.combat);
        data.turns = data.turns.filter(c => {
            const combatant = game.combats.viewed.combatants.get(c.id);
            return combatant.isOwner && combatant.isNPC;
        });
        for (let i = 0; i < data.turns.length; i++) {
            const combatant = game.combats.viewed.combatants.get(data.turns[i].id);
            const { actions, dice } = getGrade(combatant.actor);

            const currentAction = combatant.getFlag(moduleName, "currentAction");
            const currentWeapon = combatant.actor.items.get(currentAction);
            let CA;
            if (Object.keys(actions).includes(currentAction)) CA = currentAction;
            else if (currentWeapon) CA = `${currentWeapon.name} (1d${getWeaponDie(currentWeapon, dice)})`;
            else if (currentAction) CA = `Weapon Attack (${currentAction})`;
            else CA = "---";
            data.turns[i].currentAction = CA;

            const defaultAction = combatant.token.getFlag(moduleName, "defaultAction");
            const defaultWeapon = combatant.actor.items.get(defaultAction);
            data.turns[i].defaultAction = Object.keys(actions).includes(defaultAction) ?
                defaultAction
                : defaultWeapon ?
                    `${defaultWeapon.name} (1d${getWeaponDie(defaultWeapon, dice)})`
                    : "Standard Action";
        }
        return data;
    }

    activateListeners(html) {
        html = $(html[2]);

        html.parent().prop("id", "combat");
        html.prop("id", "combat-tracker");

        html.find("li.combatant").each(function () {
            const combatant = game.combats.viewed.combatants.get($(this).data("combatant-id"))
            $(this).find("div.token-initiative").click(event => {
                event.stopPropagation();
                game.combats.viewed.rollInitiative([combatant.id]);
            });

            $(this).hover(CombatTracker.prototype._onCombatantHoverIn.bind(game.combats), CombatTracker.prototype._onCombatantHoverOut.bind(game.combats));
            $(this).click(CombatTracker.prototype._onCombatantMouseDown.bind(game.combats));
        });

        CombatTracker.prototype._contextMenu.call(ui.combat, html);
    }
}
