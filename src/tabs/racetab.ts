import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { StatBlockElement } from 'src/htmlelements.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';

export class RaceTab extends Tab
{
	render()
	{
		this.content.empty();
		this.requiredList = [];

		const metadata = this.request("metadata");

		const race = new Dropdown(this.content, "Race").source(metadata, `races/{setting}/content`).link(metadata.race, "name").required(this);

		let splitElmt = this.content.createDiv({ cls: "character-builder-splitter-container" });
		const subrace = new Dropdown(splitElmt, "Sous-race").source(metadata, `races/{setting}/content/{race/name}/subraces`).link(metadata.race, "subname").required(this);
		const feature = new Dropdown(splitElmt, "Bonus racial").source(metadata, `races/{setting}/content/{race/name}/features`).link(metadata.race, "feature").required(this);

		const statBlock = new StatBlockElement(this.content, metadata, {
			hasNormalRow: true,
			hasRacialValuePicker: true
		});

		race.onChange((value) => {
			subrace.update();
			feature.update();

			statBlock.update();
		});
	}
}
