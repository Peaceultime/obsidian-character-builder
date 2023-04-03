import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';

export class RaceTab extends Tab
{
	render()
	{
		this.content.empty();
		this.requiredList = [];

		const metadata = this.request("metadata");
		const raceData = Cache.cache(`races/${metadata.setting}/content/${metadata.race.name}/race`);

		const race = new Dropdown(this.content, "Race").source(metadata, `races/{setting}/content`).link(metadata.race, "name").required(this);
		let splitElmt = this.content.createDiv({ cls: "character-builder-splitter-container" });
		const bonus1 = new Dropdown(splitElmt, "Bonus de +3", false).source(StatBlockNames).link(metadata.race, "bonus1").value(metadata.race?.bonus1 ?? raceData?.bonus1 === "any" ? "" : raceData?.bonus1 ?? "").disable(raceData?.bonus1 !== "any" ?? true);
		const bonus2 = new Dropdown(splitElmt, "Bonus de +3", false).source(StatBlockNames).link(metadata.race, "bonus2").value(metadata.race?.bonus2 ?? raceData?.bonus2 === "any" ? "" : raceData?.bonus2 ?? "").disable(raceData?.bonus2 !== "any" ?? true);
		const bonus3 = new Dropdown(splitElmt, "Bonus de +3", false).source(StatBlockNames).link(metadata.race, "bonus3").value(metadata.race?.bonus3 ?? raceData?.bonus3 === "any" ? "" : raceData?.bonus3 ?? "").disable(raceData?.bonus3 !== "any" ?? true);
		const malus1 = new Dropdown(splitElmt, "", false).source(StatBlockNames).disable(true);
		if(raceData && raceData.hasOwnProperty("malus1"))
			malus1.name(`Malus de -6 en ${StatBlockNames[raceData.malus1]}, mais bonus de +6`).setting.classList.remove("hidden");
		else
			malus1.setting.classList.add("hidden");
		splitElmt = this.content.createDiv({ cls: "character-builder-splitter-container" });
		const subrace = new Dropdown(splitElmt, "Sous-race").source(metadata, `races/{setting}/content/{race/name}/subraces`).link(metadata.race, "subname").required(this);
		const feature = new Dropdown(splitElmt, "Bonus racial").source(metadata, `races/{setting}/content/{race/name}/features`).link(metadata.race, "feature").required(this);

		race.onChange((value) => {
			const raceData = Cache.cache(`races/${metadata.setting}/content/${value}/race`);
			subrace.update();
			feature.update();
			bonus1.value(raceData?.bonus1 === "any" ? "" : raceData.bonus1).disable(raceData?.bonus1 !== "any");
			bonus2.value(raceData?.bonus2 === "any" ? "" : raceData.bonus2).disable(raceData?.bonus2 !== "any");
			bonus3.value(raceData?.bonus3 === "any" ? "" : raceData.bonus3).disable(raceData?.bonus3 !== "any");
			malus1.value("").disable(raceData?.malus1 !== "any");

			if(raceData && raceData.hasOwnProperty("malus1"))
				malus1.name(`Malus de -6 en ${StatBlockNames[raceData.malus1]}, mais bonus de +6`).setting.classList.remove("hidden");
			else
				malus1.setting.classList.add("hidden");
		});
	}
}

class DropdownGroup
{
	
}