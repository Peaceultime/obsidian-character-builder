import { DropdownComponent, ToggleComponent, ButtonComponent, TextComponent, PopoverSuggest } from 'obsidian';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { Stat, StatBlock, StatBlockNames } from 'src/metadata.ts';
import { Dropdown } from 'src/components.ts';
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
	limit(min?: number, max?: number, step: number = 1)
	{
		this.min = min;
		this.max = max;
		//this.component.attributes
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

	level: number;
}
export class SubstatPicker
{
	container: HTMLElement;

	substats: string[];
	statElmts: HTMLElement[] = [];
	valueElmts: HTMLStatELement[] = [];
	normalElmts: HTMLELement[] = [];
	highElmts: HTMLELement[] = [];
	extremeElmts: HTMLELement[] = [];

	remaining: number;
	remainingElmt: HTMLElement;

	metadata: Metadata;
	levelSubstats: Substats;
	options: SubstatsOptions;

	cb: () => void;

	constructor(parent: HTMLElement, metadata: Metadata, options: SubstatsOptions)
	{
		const settings = Cache.cache("settings");

		this.container = parent.createDiv();
		this.container.createEl("h5", { cls: "character-builder-talents-title", text: "Stats secondaires" });
		this.container.createDiv("character-builder-substats-container", div => {
			if(options?.hasStatPicker || options?.showRemaining)
				div.createDiv(undefined, div2 => {
					if(options?.hasStatPicker)
					{
						const suggest = new SuggestComponent(div2).onSuggest(value => Substats.map(e => e.name).filter(e => e.toLowerCase().includes(value.toLowerCase()) && !this.substats.includes(e)));
						suggest.onSelect((v) => { this.addItem(v); suggest.setValue(""); });
					}

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
		this.substats = [];
		this.remaining = options.statAmount ?? settings.substatAmount;

		this.levelSubstats = this.metadata.levels.find(e => e.level === this.options.level)?.buffedSubstats;
		const substats = Object.keys(this.levelSubstats);
		for(let i = 0; i < substats.length; i++)
			this.addItem(substats[i], this.levelSubstats[substats[i]]);

		this.update();
	}
	onChange(cb: () => void): SubstatPicker
	{
		this.cb = cb;

		return this;
	}
	update(): void
	{
		for(let i = 0; i < this.substats.length; i++)
		{
			const substat = this.substats[i];
			const stat = Substats.find(e => e.name === substat).stat;

			let statValue = this.metadata.statBlock[stat].initial + this.metadata.statBlock[stat].bonus, substatValue = 0;
			for(let j = 1; j <= this.options?.level; j++)
			{
				statValue += this.metadata.levels.find(e => e.level === j)?.buffedStat === stat ? 3 : 0;
				substatValue += this.metadata.levels.find(e => e.level === j)?.buffedSubstats[substat] || 0;
			}

			if(this.options?.hasValuePicker && substatValue - this.levelSubstats[substat] >= this.options.level * 2)
			{
				this.valueElmts.limit()
			}

			if(this.options?.hasNormal && this.normalElmts[i])
				this.normalElmts[i].innerHTML = Math.floor(statValue + substatValue);
			if(this.options?.hasHigh && this.highElmts[i])
				this.highElmts[i].innerHTML = Math.floor((statValue + substatValue) / 2);
			if(this.options?.hasExtreme && this.extremeElmts[i])
				this.extremeElmts[i].innerHTML = Math.floor((statValue + substatValue) / 5);
		}

		if(this.options?.showRemaining && this.remainingElmt)
			this.remainingElmt.innerHTML = this.remaining?.toString();
	}
	private addItem(substat: string, value?: number, limit?: number): void
	{
		const container = this.content.createDiv("character-builder-substat-container");
		this.statElmts.push(container);

		this.substats.push(substat);
		this.levelSubstats[substat] = value || 0;

		const substatElmt = container.createSpan({ cls: "character-builder-substat-name", text: substat });
		if(this.options?.hasStatPicker)
		{
			substatElmt.createSpan("character-builder-substat-remove").addEventListener("click", () => this.removeItem(substat));
		}
		if(this.options?.hasValuePicker)
		{
			const valueElmt = //new HTMLStatElement(container).change(() => this.update());

			new HTMLStatElement(container, 0, limit ?? 20).change((oldVal, newVal) => {
					if(oldVal === newVal)
						return;

					if(oldVal !== undefined)
						this.remaining += oldVal;

					if(newVal > this.remaining)
						newVal = this.remaining, this.remaining = 0;
					else
						this.remaining -= newVal;

					this.levelSubstats[substat] = newVal;
					this.update();
					this.cb && this.cb();

					return newVal;
				}).value(this.levelSubstats[substat]);

			this.valueElmts.push(valueElmt);
		}
		if(this.options?.hasNormal || this.options?.hasHigh || this.options?.hasExtreme)
		{
			container.createDiv(undefined, div => {
				if(this.options?.hasNormal)
				{
					this.normalElmts.push(container.createEl("i"));
				}
				if(this.options?.hasHigh)
				{
					this.highElmts.push(container.createEl("i"));
				}
				if(this.options?.hasExtreme)
				{
					this.extremeElmts.push(container.createEl("i"));
				}
			});
		}

		this.update();
	}
	private removeItem(substat: string): void
	{
		const idx = this.substats.findIndex(e => e === substat);

		if(idx === -1)
			return;

		if(this.options?.hasValuePicker)
		{
			this.valueElmts.splice(idx, 1);
		}
		if(this.options?.hasNormal)
		{
			this.normalElmts.splice(idx, 1);
		}
		if(this.options?.hasHigh)
		{
			this.highElmts.splice(idx, 1);
		}
		if(this.options?.hasExtreme)
		{
			this.extremeElmts.splice(idx, 1);
		}

		this.remaining += this.levelSubstats[substat];
		delete this.levelSubstats[substat];

		this.substats.splice(idx, 1);
		this.statElmts[idx].remove();
		this.statElmts.splice(idx, 1);

		this.update();
		this.cb && this.cb();
	}
}

export class SuggestComponent extends TextComponent
{
	popover: PopoverSuggest;

	renderCb: (value: string, elmt: HTMLElement) => void;
	suggestCb: (value: string) => void;
	selectCb: (value: string) => void;
	constructor(parent: HTMLElement)
	{
		super(parent);
		this.popover = new PopoverSuggest(app);
		this.popover.selectSuggestion = this.selectSuggestion.bind(this);
		this.popover.renderSuggestion = this.renderSuggestion.bind(this);

		this.inputEl.addEventListener("input", () => this.onInputChange());
		this.inputEl.addEventListener("focus", () => this.onInputChange());
		this.inputEl.addEventListener("blur", () => this.popover.close());
		this.popover.suggestEl.on("mousedown", ".suggestion-item", e => e.preventDefault());
	}

	private onInputChange()
	{
		const suggests = this.suggestCb && this.suggestCb(this.getValue());
		if(suggests.length > 0)
		{
			this.popover.suggestions.setSuggestions(suggests);
			this.popover.open();
			this.popover.setAutoDestroy(this.inputEl);
			this.popover.reposition(SuggestComponent.getPos(this.inputEl));
		}
		else
			this.popover.close();
	}
	private selectSuggestion(value: string): void
	{
		this.setValue(value);

		this.selectCb && this.selectCb(value);
		this.inputEl.trigger("input");

		this.popover.close();
	}
	private renderSuggestion(value: string, elmt: HTMLElement): void
	{
		if(this.renderCb)
			this.renderCb(value, elmt);
		else
		{
			const strong = this.getValue();
			const pos = value.toLowerCase().indexOf(strong.toLowerCase());
			elmt.createDiv(undefined, div => {
				div.createSpan({text: value.substring(0, pos)});
				div.createEl("strong", {text: value.substring(pos, pos + strong.length)});
				div.createSpan({text: value.substring(pos + strong.length)});
			});
		}
	}
	onRenderSuggest(cb: (value: string, elmt: HTMLElement) => void): SuggestComponent
	{
		this.renderCb = cb;

		return this;
	}
	onSuggest(cb: (value: string) => string[]): SuggestComponent
	{
		this.suggestCb = cb;

		return this;
	}
	onSelect(cb: (value: string) => void): SuggestComponent
	{
		this.selectCb = cb;

		return this;
	}

	static getPos(e: HTMLElement)
	{
		const elmt = e;
		for (var n = 0, i = 0, r = null; e && e !== r;)
		{
			n += e.offsetTop,
			i += e.offsetLeft;
			for (var o = e.offsetParent, a = e.parentElement; a && a !== o; )
				n -= a.scrollTop,
				i -= a.scrollLeft,
				a = a.parentElement;
			o && o !== r && (n -= o.scrollTop,
			i -= o.scrollLeft),
			e = o
		}
		return {
			left: i,
			right: i + elmt.offsetWidth,
			top: n,
			bottom: n + elmt.offsetHeight
		};
	}
}