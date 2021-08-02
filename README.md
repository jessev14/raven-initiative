![All Downloads](https://img.shields.io/github/downloads/jessev14/raven-initiative/total?style=for-the-badge)

[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%raven-initiative&colorB=4aa94a)](https://forge-vtt.com/bazaar#package=raven-initiative)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jessev14)

# Raven Initiative

Commissioned by Rellek.

Raven Initiative is a alternative initiative system for DnD 5e.

[Rules Doc](https://docs.google.com/document/d/1HzB2HhfarNag6lS1FqOhdPJu18F3Ofz0sUGEKnYHbOE/edit#heading=h.t80xhxj4b5rs)

<img src="/img/ri-demo.png" width="600"/>

## Rule Changes

* Instead of rolling `1d20 + DEX mod` for initiative, different dice are rolled based on the action chosen at the beginning of the round.
* Lower initiative results go first in the round, with ties won by higher DEX score.
* The chosen action for the round can be changed mid-round, but a new inititiave die must be rolled and added to the previous initiative total.
* Initiative is re-rolled every round.

## Module Features

In addition to implementing the above rule changes, this module adds features to streamline the Raven Initiative system in FoundryVTT:

* NPCs have default actions (unique to each token) which can be rolled with single button click.
* GM users have access to a Initiative Info Panel to observe all NPCs, their current action, and their default action.
* Initiative Upgrade/Downgrade features can be customized and added to actors to impose upgraded or downgraded initiative dice.
* Player users have new combatant context menu items to better control their characters.
* Changing actions can also be done by clicking a combatant's initiative number in the combat tracker.
