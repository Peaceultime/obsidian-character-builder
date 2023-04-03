import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { Stat, StatBlock, StatBlockNames } from 'src/metadata.ts';
import { Dropdown } from 'src/components.ts';

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
	dropdownGroup: DropdownGroup;
	normalElmts: HTMLELement[] = [];
	highElmts: HTMLELement[] = [];
	extremeElmts: HTMLELement[] = [];

	remaining: number;
	remainingElmt: HTMLElement;

	metadata: Metadata;
	options: StatBlockOptions;

	bufferElmt: HTMLElement;

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
			this.dropdownGroup = new DropdownGroup();

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

					return newVal;
				}).value(stat.initial || settings.minStat));
			}
			if(options?.hasRacialValuePicker)
				this.racePickerElmts.push(this.dropdownGroup.add(new DropdownComponent(this.bufferElmt, )));
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
			this.row("Bonus raciaux", this.racePickerElmts.map(e => e.component));
		if(options?.hasNormalRow)
			this.row("Réussite normale", this.normalElmts);
		if(options?.hasHighRow)
			this.row("Réussite haute", this.highElmts);
		if(options?.hasExtremeRow)
			this.row("Réussite extreme", this.extremeElmts);

		if(options?.showRemaining)
		{
			const total = this.container.createDiv().createDiv({ cls: 'character-builder-total-stats' });
			total.createEl("span", { text: 'Restant: ' });
			this.remainingElmt = total.createEl("strong");
		}

		this.update();
	}
	update()
	{
		const stats = Object.keys(StatBlockNames);
		for(let i = 0; i < stats.length; i++)
		{
			if(this.options?.hasNormalRow && this.normalElmts[i])
				this.normalElmts[i].innerHTML = Math.floor(this.metadata.statBlock[stats[i]].initial);
			if(this.options?.hasHighRow && this.highElmts[i])
				this.highElmts[i].innerHTML = Math.floor(this.metadata.statBlock[stats[i]].initial / 2);
			if(this.options?.hasExtremeRow && this.extremeElmts[i])
				this.extremeElmts[i].innerHTML = Math.floor(this.metadata.statBlock[stats[i]].initial / 5);
		}

		if(this.options?.showRemaining && this.remainingElmt)
			this.remainingElmt.innerHTML = this.remaining?.toString();

		//Update racial picker choices
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
class DropdownGroup
{
	options: string[];

	dropdowns: DropdownComponent[];

	constructor(options: string[])
	{

	}
	add(dropdown: DropdownComponent): DropdownComponent
	{
		//dropdown.addOptions();

		return dropdown;
	}
}
