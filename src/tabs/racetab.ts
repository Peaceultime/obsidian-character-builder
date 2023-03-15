import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';

export class RaceTab extends Tab
{
	render()
	{
		this.content.empty();
		this.requiredList = [];

		const metadata = this.request("metadata");

		const race = new Dropdown(this.content, "Race").source(metadata, `races/{setting}/content`).link(metadata, "race").required(this);
		const splitElmt = this.content.createDiv({ cls: "character-builder-splitter-container" });
		const subrace = new Dropdown(splitElmt, "Sous-race").source(metadata, `races/{setting}/content/{race}/subraces`).link(metadata, "subrace").required(this);
		const feature = new Dropdown(splitElmt, "Bonus racial").source(metadata, `races/{setting}/content/{race}/features`).link(metadata, "feature").required(this);

		race.onChange(() => { subrace.update(); feature.update(); })
	}
}