import { DropdownComponent, ToggleComponent, ButtonComponent } from 'obsidian';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { Stat, StatBlock, StatBlockNames } from 'src/metadata.ts';
import { Dropdown, SearchField } from 'src/components.ts';
import Substats from 'src/substats.js';

export class HTMLStatElement {
	min: number;
	max: number;
	val: number;
	component: HTMLElement;
	linkSrc?: any;
	linkedProperty?: string;
	cb: (oldVal: number, newVal: number) => void;
	constructor(parent: HTMLElement, min?: number, max?: number, step: number = 1)
	{
		this.min = min;
		this.max = max;
		this.component = parent.createEl("input", { type: "number", cls: "character-builder-stat-input", attr: { min: min, max: max, step: step } });
		this.component.addEventListener("change", this._onChange.bind(this));
	}
	value(value: number): HTMLStatElement
	{
		this.component.valueAsNumber = value;
		this._onChange();
		return this;
	}
	link(dataSrc: any, propertyName?: string): HTMLStatElement
	{
		this.linkSrc = dataSrc;
		this.linkedProperty = propertyName;

		if(this.linkSrc && this.linkedProperty)
			this.value(this.linkSrc[this.linkedProperty]);

		return this;
	}
	change(cb: (oldVal: number, newVal: number) => void): HTMLStatElement
	{
		this.cb = cb;
		return this;
	}
	private _onChange(): void
	{
		//CHECKING VALIDITY
		let value = parseInt(this.component.valueAsNumber);
		if(isNaN(value) || value === "" || value === undefined)
			value = parseInt(this.component.attributes["min"].value) || 0;
		if(this.component.validity.rangeOverflow)
			value = parseInt(this.component.attributes["max"].value) || 0;
		else if(this.component.validity.rangeUnderflow)
			value = parseInt(this.component.attributes["min"].value) || 0;
		else if(this.component.validity.stepMismatch)
			value -= value % parseInt(this.component.attributes["step"].value) || 1;
		this.component.valueAsNumber = value;

		//SENDING CALLBACK
		const oldVal = this.val;
		this.val = value;
		if(this.cb)
		{
			const returned = this.cb(oldVal, value);
			if(returned === false)
			{
				this.val = oldVal;
				this.component.valueAsNumber = oldVal;
			}
			else if(returned !== undefined)
			{
				this.val = returned;
				this.component.valueAsNumber = returned;
			}

			if(this.linkSrc && this.linkedProperty)
				this.linkSrc[this.linkedProperty] = this.val;
		}
		else if(this.linkSrc && this.linkedProperty)
			this.linkSrc[this.linkedProperty] = value;
	}
}
export interface StatBlockOptions
{
	statAmount?: number;

	hasNormalRow?: boolean;
	hasHighRow?: boolean;
	hasExtremeRow?: boolean;
	hasValuePicker?: boolean;
	hasRacialValuePicker?: boolean;
	hasEvenLevelPicker?: number;

	showRemaining?: boolean;

	maxStat?: number;
}
export class StatBlockElement
{
	container: HTMLElement;
	table: HTMLElement;
	head: HTMLElement;
	body: HTMLElement;

	pickerElmts: HTMLStatELement[] = [];
	racePickerElmts: Dropdown[] = [];
	dropdownGroup: RacialDropdownGroup;
	normalElmts: HTMLELement[] = [];
	highElmts: HTMLELement[] = [];
	extremeElmts: HTMLELement[] = [];
	evenLevelPickerElmts: ToggleComponent[] = [];

	remaining: number;
	remainingElmt: HTMLElement;

	metadata: Metadata;
	options: StatBlockOptions;

	bufferElmt: HTMLElement;

	cb: () => void;
	constructor(parent: HTMLElement, metadata: Metadata, options: StatBlockOptions)
	{
		const settings = Cache.cache("settings");

		this.container = parent.createDiv("character-builder-statblock-container");

		this.table = this.container.createEl("table", { cls: "character-builder-table" });
		this.head = this.table.createEl("thead").createEl("tr", { cls: ["character-builder-table-row", "character-builder-table-head"] });
		this.body = this.table.createEl("tbody");

		this.bufferElmt = this.container.createDiv();

		this.metadata = metadata;
		this.options = options;
		this.remaining = options.statAmount ?? settings.statAmount;

		this.header(Object.values(StatBlockNames));

		if(options?.hasRacialValuePicker)
			this.dropdownGroup = new RacialDropdownGroup(this);

		const stats = Object.keys(StatBlockNames);
		for(let i = 0; i < stats.length; i++)
		{
			const stat = this.metadata.statBlock[stats[i]];
			if(options?.hasValuePicker)
			{
				this.pickerElmts.push(new HTMLStatElement(this.bufferElmt, settings.minStat, options.maxStat ?? settings.maxInitialStat).change((oldVal, newVal) => {
					if(oldVal === newVal)
						return;

					if(oldVal !== undefined)
						this.remaining += oldVal;

					if(newVal > this.remaining)
						newVal = this.remaining, this.remaining = 0;
					else
						this.remaining -= newVal;

					stat.initial = newVal;
					this.update();
					this.cb && this.cb();

					return newVal;
				}).value(stat.initial || settings.minStat));
			}
			if(options?.hasRacialValuePicker)
				this.racePickerElmts.push(this.dropdownGroup.add(new DropdownComponent(this.bufferElmt)));
			if(options?.hasEvenLevelPicker)
				this.evenLevelPickerElmts.push((new ToggleComponent(this.bufferElmt)).setValue(this.metadata.levels.find(e => e.level === options?.hasEvenLevelPicker).buffedStat === stats[i]).onChange(e => {
					this.metadata.levels.find(e => e.level === options?.hasEvenLevelPicker).buffedStat = (e ? stats[i] : ""); 
					this.update(); 
					this.cb && this.cb();
				}));
			if(options?.hasNormalRow)
				this.normalElmts.push(this.bufferElmt.createEl("i"));
			if(options?.hasHighRow)
				this.highElmts.push(this.bufferElmt.createEl("i"));
			if(options?.hasExtremeRow)
				this.extremeElmts.push(this.bufferElmt.createEl("i"));
		}

		if(options?.hasValuePicker)
			this.row("Statistique", this.pickerElmts.map(e => e.component));
		if(options?.hasRacialValuePicker)
			this.row("Bonus raciaux", this.racePickerElmts.map(e => e.selectEl));
		if(options?.hasEvenLevelPicker)
			this.row("Bonus de niveau", this.evenLevelPickerElmts.map(e => e.toggleEl));
		if(options?.hasNormalRow)
			this.row("Réussite normale", this.normalElmts);
		if(options?.hasHighRow)
			this.row("Réussite haute", this.highElmts);
		if(options?.hasExtremeRow)
			this.row("Réussite extreme", this.extremeElmts);

		if(options?.hasRacialValuePicker && metadata.race.name)
		{
			this.dropdownGroup.setRace(Cache.cache(`races/${metadata.setting}/content/${metadata.race.name}/race`));
			this.dropdownGroup.setRace(metadata.race, false);
		}

		if(options?.showRemaining)
		{
			const total = this.container.createDiv().createDiv({ cls: 'character-builder-total-stats' });
			total.createEl("span", { text: 'Restant: ' });
			this.remainingElmt = total.createEl("strong");
		}

		this.update();
	}
	onChange(cb: () => void): StatBlockElement
	{
		this.cb = cb;

		return this;
	}
	update(): void
	{
		const stats = Object.keys(StatBlockNames);
		for(let i = 0; i < stats.length; i++)
		{
			const stat = this.metadata.statBlock[stats[i]];
			if(this.metadata.race.bonus1 === stats[i] || this.metadata.race.bonus2 === stats[i] || this.metadata.race.bonus3 === stats[i])
				stat.bonus = 3;
			else if(this.metadata.race.bonus4 === stats[i])
				stat.bonus = 6;
			else if(this.metadata.race.malus1 === stats[i])
				stat.bonus = -6;
			else
				stat.bonus = 0;

			let levelBonus = 0;
			if(this.options?.hasEvenLevelPicker)
			{
				for(let j = 2; j <= this.options?.hasEvenLevelPicker; j += 2)
					levelBonus += this.metadata.levels.find(e => e.level === j).buffedStat === stats[i] ? 3 : 0;

				const buffedStat = this.metadata.levels.find(e => e.level === this.options?.hasEvenLevelPicker).buffedStat;
				if(this.options?.maxStat && stat.initial + stat.bonus + levelBonus >= this.options?.maxStat && buffedStat !== stats[i])
					this.evenLevelPickerElmts[i]?.setDisabled(true);
				else if(buffedStat === "")
					this.evenLevelPickerElmts[i]?.setDisabled(false);
				else
					this.evenLevelPickerElmts[i]?.setDisabled(buffedStat !== stats[i]);
			}

			if(this.options?.hasNormalRow && this.normalElmts[i])
				this.normalElmts[i].innerHTML = Math.floor(stat.initial + stat.bonus + levelBonus);
			if(this.options?.hasHighRow && this.highElmts[i])
				this.highElmts[i].innerHTML = Math.floor((stat.initial + stat.bonus + levelBonus) / 2);
			if(this.options?.hasExtremeRow && this.extremeElmts[i])
				this.extremeElmts[i].innerHTML = Math.floor((stat.initial + stat.bonus + levelBonus) / 5);
		}

		if(this.options?.showRemaining && this.remainingElmt)
			this.remainingElmt.innerHTML = this.remaining?.toString();

		this.dropdownGroup?.update();
	}
	setRace(race: Race): void
	{
		this.metadata.race.name = race.name;
		this.metadata.race.subname = "";
		this.metadata.race.feature = "";
		this.metadata.race.bonus1 = race.bonus1;
		this.metadata.race.bonus2 = race.bonus2;
		this.metadata.race.bonus3 = race.bonus3;
		this.metadata.race.bonus4 = race.bonus4;
		this.metadata.race.malus1 = race.malus1;

		if(this.options?.hasRacialValuePicker)
			this.dropdownGroup.setRace(this.metadata.race);

		this.update();
	}
	private header(headers: string[]): void
	{
		this.head.empty();
		this.head.createEl("th", { cls: "character-builder-table-header" });

		for(let i = 0; i < headers.length; i++)
			this.head.createEl("th", { cls: "character-builder-table-header", text: headers[i] });
	}
	private row(title: string, elmts: HTMLElement[]): void
	{
		const tr = this.body.createEl("tr", { cls: "character-builder-table-row" });
		tr.createEl("td", { cls: "character-builder-table-descriptor", text: title });

		for(let i = 0; i < elmts.length; i++)
			tr.createEl("td", { cls: "character-builder-table-cell" }).appendChild(elmts[i]);
	}
}
class RacialDropdownGroup
{
	statBlock: StatBlockElement;
	race: Race;

	dropdowns: DropdownComponent[];

	constructor(statBlock: StatBlockElement)
	{
		this.statBlock = statBlock;
		this.dropdowns = [];
	}
	setRace(race: Race, disable: boolean = true): void
	{
		this.race = race;

		if(disable)
			for(let i = 0; i < this.dropdowns.length; i++)
				this.dropdowns[i].setDisabled(false).setValue();

		if(this.race.bonus1)
		{
			const drop = this.dropdowns[Object.keys(StatBlockNames).findIndex(e => e === this.race.bonus1)]
			drop.setValue("+3");
			if(disable)
				drop.setDisabled(true);
		}
		if(this.race.bonus2)
		{
			const drop = this.dropdowns[Object.keys(StatBlockNames).findIndex(e => e === this.race.bonus2)]
			drop.setValue("+3");
			if(disable)
				drop.setDisabled(true);
		}
		if(this.race.bonus3)
		{
			const drop = this.dropdowns[Object.keys(StatBlockNames).findIndex(e => e === this.race.bonus3)]
			drop.setValue("+3");
			if(disable)
				drop.setDisabled(true);
		}
		if(this.race.bonus4)
		{
			const drop = this.dropdowns[Object.keys(StatBlockNames).findIndex(e => e === this.race.bonus4)]
			drop.setValue("+6");
			if(disable)
				drop.setDisabled(true);
		}
		if(this.race.malus1)
		{
			const drop = this.dropdowns[Object.keys(StatBlockNames).findIndex(e => e === this.race.malus1)]
			drop.addOption("-6", "-6");
			drop.setValue("-6");
			if(disable)
				drop.setDisabled(true);
		}
	
		this.statBlock.update();
	}
	add(dropdown: DropdownComponent): DropdownComponent
	{
		const idx = this.dropdowns.push(dropdown) - 1;
		dropdown.onChange(value => {
			const statName = Object.keys(StatBlockNames)[idx];
			
			if(value === "+3")
			{
				if(!this.race.bonus1)
					this.race.bonus1 = statName;
				else if(!this.race.bonus2)
					this.race.bonus2 = statName;
				else if(!this.race.bonus3)
					this.race.bonus3 = statName;
			}
			else if(value === "+6")
				this.race.bonus4 = statName;
			else
			{
				if(this.race.bonus1 === statName)
					this.race.bonus1 = undefined;
				else if(this.race.bonus2 === statName)
					this.race.bonus2 = undefined;
				else if(this.race.bonus3 === statName)
					this.race.bonus3 = undefined;
				else if(this.race.bonus4 === statName)
					this.race.bonus4 = undefined;
			}

			this.statBlock.update();
			this.statBlock.cb && this.statBlock.cb();
		});

		this.update();

		return dropdown;
	}
	update()
	{
		const options = [];
		if(this.race?.malus1 && !this.race?.bonus4)
		{
			options.push("+6");
		}
		if(!this.race?.bonus1 || !this.race?.bonus2 || !this.race?.bonus3)
		{
			options.push("+3");
		}

		for(let i = 0; i < this.dropdowns.length; i++)
		{
			const value = this.dropdowns[i].getValue();
			let j, L = this.dropdowns[i].selectEl.options.length - 1;
			for(j = L; j >= 0; j--)
			{
				if(!value || value !== this.dropdowns[i].selectEl.options[j].value)
					this.dropdowns[i].selectEl.remove(j);
			}

			this.dropdowns[i].addOption("", undefined);

			if(value === "-6")
				this.dropdowns[i].addOption("-6", "-6");

			for(j = 0; j < options.length; j++)
			{
				if(!value || value !== options[j])
					this.dropdowns[i].addOption(options[j], options[j]);
			}
		}
	}
}
export interface SubstatsOptions
{
	statAmount?: number;

	hasNormal?: boolean;
	hasHigh?: boolean;
	hasExtreme?: boolean;
	hasStatPicker?: boolean;
	hasValuePicker?: boolean;

	showRemaining?: boolean;

	level?: number;
}
export class SubstatPicker
{
	container: HTMLElement;

	substats: string[];
	statElmts: Dropdown[] = [];
	valueElmts: HTMLStatELement[] = [];
	normalElmts: HTMLELement[] = [];
	highElmts: HTMLELement[] = [];
	extremeElmts: HTMLELement[] = [];

	remaining: number;
	remainingElmt: HTMLElement;

	metadata: Metadata;
	options: SubstatsOptions;

	constructor(parent: HTMLElement, metadata: Metadata, options: SubstatsOptions)
	{
		const settings = Cache.cache("settings");

		this.container = parent.createDiv();
		this.container.createEl("h5", { cls: "character-builder-talents-title", text: "Stats secondaires" });
		this.container.createDiv("character-builder-substats-container", div => {
			if(options?.hasStatPicker || options?.showRemaining)
				div.createDiv(undefined, div2 => {
					if(options?.hasStatPicker)
						new ButtonComponent(div2).setIcon("lucide-plus").onClick(() => this.addItem()).setClass("character-builder-substats-add-button");

					if(options?.showRemaining)
					{
						const total = div2.createDiv({ cls: 'character-builder-total-stats' });
						total.createEl("span", { text: 'Restant: ' });
						this.remainingElmt = total.createEl("strong");
					}
				});
			this.content = div.createDiv("character-builder-substats-content");
		});

		this.metadata = metadata;
		this.options = options;
		this.remaining = options.statAmount ?? settings.substatAmount;

		const substats = Object.keys(this.metadata.substats);
		for(let i = 0; i < substats.length; i++)
		{
			this.addStat(substats[i], this.metadata.substats[substats[i]]);
		}

		this.update();
	}
	update(): void
	{
		/*const stats = Object.keys(StatBlockNames);
		for(let i = 0; i < stats.length; i++)
		{
			const stat = this.metadata.statBlock[stats[i]];
			if(this.metadata.race.bonus1 === stats[i] || this.metadata.race.bonus2 === stats[i] || this.metadata.race.bonus3 === stats[i])
				stat.bonus = 3;
			else if(this.metadata.race.bonus4 === stats[i])
				stat.bonus = 6;
			else if(this.metadata.race.malus1 === stats[i])
				stat.bonus = -6;
			else
				stat.bonus = 0;

			if(this.options?.hasNormalRow && this.normalElmts[i])
				this.normalElmts[i].innerHTML = Math.floor(stat.initial + stat.bonus);
			if(this.options?.hasHighRow && this.highElmts[i])
				this.highElmts[i].innerHTML = Math.floor((stat.initial + stat.bonus) / 2);
			if(this.options?.hasExtremeRow && this.extremeElmts[i])
				this.extremeElmts[i].innerHTML = Math.floor((stat.initial + stat.bonus) / 5);
		}

		if(this.options?.showRemaining && this.remainingElmt)
			this.remainingElmt.innerHTML = this.remaining?.toString();

		this.dropdownGroup?.update();*/
	}
	private addItem(substat?: string, value?: number, limit?: number): void //When substat is undefined, it means the add button have been pressed, so the user should select its substat later.
	{
		const container = this.content.createDiv("character-builder-substat-container");

		if(this.options?.hasStatPicker)
		{
			container.createSpan("character-builder-substat-remove").addEventListener("click", () => this.remove(talent));
			new SearchField(container, "Stat").onSuggest(value => Substats.map(e => e.name).filter(e => e.includes(value))).onSelect(console.log);
			//container.createSpan("character-builder-substat-remove").addEventListener("click", () => this.remove(talent));
		}
		if(this.options?.hasValuePicker)

		if(this.options?.hasNormal)

		if(this.options?.hasHigh)

		if(this.options?.hasExtreme)

		container.createDiv("character-builder-substat-container");
		container.createDiv("character-builder-substat-container");
		container.createDiv("character-builder-substat-container");
	}
	private removeItem(substat?: string): void //If substat is undefined, it is supposed to remove the blank substat.
	{

	}
}