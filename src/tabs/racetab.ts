import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';

export class RaceTab extends Tab
{
	raceData: any;

	render()
	{
		this.content.empty();
		this.requiredList = [];

		const metadata = this.request("metadata");
		this.raceData = Cache.cache(`races/${metadata.settings}/content/${metadata.race}`);

		const race = new Dropdown(this.content, "Race").source(metadata, `races/{setting}/content`).link(metadata, "race").required(this);
		let splitElmt = this.content.createDiv({ cls: "character-builder-splitter-container" });
		const subrace = new Dropdown(splitElmt, "Sous-race").source(metadata, `races/{setting}/content/{race}/subraces`).link(metadata, "subrace").required(this);
		const feature = new Dropdown(splitElmt, "Bonus racial").source(metadata, `races/{setting}/content/{race}/features`).link(metadata, "feature").required(this);
		/*splitElmt = this.content.createDiv({ cls: "character-builder-splitter-container" });
		const bonus1 = new Dropdown(splitElmt, "", false).source(StatBlockNames).desc("Bonus de +3").disable(this.raceData.frontmatter.bonus1 !== "any");
		const bonus2 = new Dropdown(splitElmt, "", false).source(StatBlockNames).desc("Bonus de +3").disable(this.raceData.frontmatter.bonus2 !== "any");
		const bonus3 = new Dropdown(splitElmt, "", false).source(StatBlockNames).desc("Bonus de +3").disable(this.raceData.frontmatter.bonus3 !== "any");
		const malus1 = new Dropdown(splitElmt, "", false).source(StatBlockNames).desc(`Malus de -6 en ${StatBlockNames[this.raceData.frontmatter.penality]}`);*/

		race.onChange((value) => {
			this.raceData = Cache.cache(`races/${metadata.settings}/content/${value}`);
			subrace.update();
			feature.update();
			/*bonus1.value(this.raceData.frontmatter.bonus1 === "any" ? "" : StatBlockNames[this.raceData.frontmatter.bonus1]).disable(this.raceData.frontmatter.bonus1 !== "any");
			bonus2.value(this.raceData.frontmatter.bonus2 === "any" ? "" : StatBlockNames[this.raceData.frontmatter.bonus2]).disable(this.raceData.frontmatter.bonus2 !== "any");
			bonus3.value(this.raceData.frontmatter.bonus3 === "any" ? "" : StatBlockNames[this.raceData.frontmatter.bonus3]).disable(this.raceData.frontmatter.bonus3 !== "any");*/
		});
	}
}