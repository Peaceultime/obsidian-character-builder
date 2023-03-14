import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';

import { RaceTab } from 'src/tabs/racetab.ts';

export class BaseTab extends Tab
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

		let splitElmt = this.content.createDiv({ cls: "character-builder-splitter-container" });
		new TextField(splitElmt, "Nom de personnage").link(this.metadata, "name").required(this);
		const settingDropdown = new Dropdown(splitElmt, "Univers", false).source(this.metadata, `races`).link(this.metadata, "setting").required(this).onChange(() => this.container.get(RaceTab).dirty = true);

		const splitContainer = this.content.createDiv({ cls: "character-builder-splitter-container" });
		const statBlockContainer = splitContainer.createDiv({ cls: "character-builder-statblock-container" });

		const stats = Object.keys(this.metadata.statBlock);
		let totalElmt;
		this.remaining = parseInt(this.options.settings.statAmount);
		table(statBlockContainer, Object.values(StatBlockNames), ["Statistique", "Réussite normale", "Réussite haute", "Réussite extrème"], (elmt, col, row) => {
			const stat = this.metadata.statBlock[stats[col]];
			const self = this;
			switch(row)
			{
				case 0:
					new HTMLStatElement(elmt, this.options.settings.minStat, this.options.settings.maxInitialStat).change(function(oldVal, newVal) {
						if(oldVal === newVal)
							return;

						if(oldVal !== undefined)
							self.remaining += oldVal;

						if(newVal > self.remaining)
						{
							newVal = self.remaining;
							self.remaining = 0;
						}
						else
						{
							self.remaining -= newVal;
						}

						stat.initial = newVal;

						try {
							this.component.parentElement.parentElement.parentElement.children[1].children[col + 1].textContent = stat.initial + stat.bonus;
							this.component.parentElement.parentElement.parentElement.children[2].children[col + 1].textContent = Math.floor((stat.initial + stat.bonus) / 2);
							this.component.parentElement.parentElement.parentElement.children[3].children[col + 1].textContent = Math.floor((stat.initial + stat.bonus) / 5);
							totalElmt.textContent = self.remaining;
						} catch(e) {}

						return newVal;
					}).value(stat.initial || this.options.settings.minStat);
					return;
				case 1:
					elmt.createEl("i", { text: stat.initial + stat.bonus });
					return;
				case 2:
					elmt.createEl("i", { text: Math.floor((stat.initial + stat.bonus) / 2) });
					return;
				case 3:
					elmt.createEl("i", { text: Math.floor((stat.initial + stat.bonus) / 5) });
					return;
				default:
					return;
			}
		});
		const totalContainer = statBlockContainer.createDiv({ cls: 'character-builder-total-stats' });
		totalContainer.createEl("span", { text: 'Restant: ' });
		totalElmt = totalContainer.createEl("strong", { text: this.remaining?.toString() });

		splitElmt = splitContainer.createDiv();
		const armorSlider = new Slider(splitElmt, `Armure max`).desc(`L'armure maximum determine le nombre de talents disponibles au niveau 1.`).range(2, 6, 2);
		const talentText = new TextField(splitElmt, `Talents au niveau 1`).disable(true).value(this.metadata.talents).class("text-field-no-editor");
		armorSlider.onChange(value => {
			this.metadata.armor = value;
			this.metadata.talents = 6 - value / 2;

			talentText.value(6 - value / 2);
		}).value(2).tooltip(true);

		new TextArea(this.content, `Backstory`).link(this.metadata, `flavoring`);
	}
}

function table(elmt: HTMLElement, header: string[], descriptors: string[], cb: (elmt: HTMLElement, col: number, row: number) => void): HTMLElement
{
	const table = elmt.createEl("table", { cls: "character-builder-table" });
	const th = table.createEl("thead").createEl("tr", { cls: ["character-builder-table-row", "character-builder-table-head"] });
	const tbody = table.createEl("tbody");

	th.createEl("th", { cls: "character-builder-table-header" });

	for(let j = 0; j < header.length; j++)
		th.createEl("th", { cls: "character-builder-table-header", text: header[j] });

	for(let i = 0; i < descriptors.length; i++)
	{
		const tr = tbody.createEl("tr", { cls: "character-builder-table-row" });
		tr.createEl("td", { cls: "character-builder-table-descriptor", text: descriptors[i] });
		for(let j = 0; j < header.length; j++)
			cb(tr.createEl("td", { cls: "character-builder-table-cell" }), j, i);
	}

	return table;
}