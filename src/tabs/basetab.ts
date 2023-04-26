import { Dropdown, TextField, MarkdownArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { StatBlockElement } from 'src/htmlelements.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';

import { RaceTab } from 'src/tabs/racetab.ts';

export class BaseTab extends Tab
{
	render()
	{
		this.content.empty();
		this.requiredList = [];

		const metadata = this.request("metadata");

		let splitElmt = this.content.createDiv({ cls: "character-builder-splitter-container" });
		new TextField(splitElmt, "Nom de personnage").link(metadata, "name").required(this);
		const settingDropdown = new Dropdown(splitElmt, "Univers", false).source(metadata, `races`).link(metadata, "setting").required(this).onChange(() => this.container.get(RaceTab).dirty = true);

		const splitContainer = this.content.createDiv({ cls: "character-builder-splitter-container" });

		new StatBlockElement(splitContainer, metadata, {
			statAmount: metadata.freeMode ? 10000 : undefined,
			maxStat: metadata.freeMode ? 1000 : undefined,
			hasHighRow: true,
			hasExtremeRow: true,
			hasValuePicker: true,

			showRemaining: !metadata.freeMode,
		});

		splitElmt = splitContainer.createDiv();
		const armorSlider = new Slider(splitElmt, `Armure max`).desc(`L'armure maximum determine le nombre de talents disponibles au niveau 1.`).range(2, 6, 2).value(2);
		const talentText = new TextField(splitElmt, `Talents au niveau 1`).disable(true).value(metadata.talents ?? 5).class("text-field-no-editor");
		armorSlider.onChange(value => {
			metadata.armor = value;
			metadata.talents = 6 - value / 2;

			talentText.value(6 - value / 2);
		}).value(metadata.armor ?? 2).tooltip(true);

		new MarkdownArea(this.content, `Backstory`, this.container.view).link(metadata, `flavoring`);
	}
}
