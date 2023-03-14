import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';

export class RaceTab extends Tab
{
	metadata: Metadata;
	constructor(container, options)
	{
		super(container, options);
		this.metadata = options.metadata;
	}
	render()
	{
		this.content.empty();
		this.requiredList = [];

		const race = new Dropdown(this.content, "Race").source(this.metadata, `races/{setting}/content`).link(this.metadata, "race").required(this);
		const splitElmt = this.content.createDiv({ cls: "character-builder-splitter-container" });
		const subrace = new Dropdown(splitElmt, "Sous-race").source(this.metadata, `races/{setting}/content/{race}/subraces`).link(this.metadata, "subrace").required(this);
		const feature = new Dropdown(splitElmt, "Bonus racial").source(this.metadata, `races/{setting}/content/{race}/features`).link(this.metadata, "feature").required(this);

		race.onChange(() => { subrace.update(); feature.update(); })
	}
}