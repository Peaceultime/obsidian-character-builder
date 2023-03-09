import { TextComponent, TextAreaComponent, DropdownComponent, SliderComponent, ValueComponent, MarkdownPreviewView } from 'obsidian';

import { CharacterBuilderCache as Cache } from 'src/cache.ts';

export abstract class VisualComponent {
	setting: HTMLElement;
	nameElmt: HTMLElement;
	descElmt: HTMLElement;
	compElmt: HTMLElement;
	component: ValueComponent;
	linkSrc?: any;
	linkedProperty?: string;
	constructor(parent: HTMLElement, name: string)
	{
		this.setting = parent.createDiv({ cls: "character-builder-setting" });
		const info = this.setting.createDiv({ cls: "character-builder-setting-info" });
		this.nameElmt = info.createDiv({ text: name, cls: "character-builder-setting-name" });
		this.compElmt = info.createDiv({ cls: "character-builder-setting-control" });
		this.descElmt = this.setting.createDiv({ cls: "character-builder-setting-description" });
		this.linkedProperty = undefined;
	}
	name(name: string): VisualComponent
	{
		this.nameElmt.innerHTML = name;

		return this;
	}
	desc(desc: string): VisualComponent
	{
		this.descElmt.innerHTML = desc;

		return this;
	}
	link(dataSrc: any, propertyName?: string): VisualComponent
	{
		this.linkSrc = dataSrc;
		this.linkedProperty = propertyName;

		if(this.linkSrc && this.linkedProperty)
			this.value(this.linkSrc[this.linkedProperty]);

		return this;
	}
	class(clsName: string): VisualComponent
	{
		this.setting.classList.toggle(clsName);

		return this;
	}
	value(value: string): VisualComponent
	{
		this.component.setValue(value?.toString());
		this.component.changeCallback(value);

		return this;
	}
	disable(state: boolean): VisualComponent
	{
		this.component.setDisabled(state);

		return this;
	}

	abstract onChange(cb): VisualComponent;
}
export class Dropdown extends VisualComponent {
	src: string;
	dataSource: any;
	cache: any;
	hasDynamicDescription: boolean;
	constructor(parent: HTMLElement, name: string, hasDynamicDescription: boolean = true)
	{
		super(parent, name);
		this.hasDynamicDescription = hasDynamicDescription;
		this.component = new DropdownComponent(this.compElmt);
		this.onChange(value => {});
	}
	source(dataSrc: any, src: string): Dropdown
	{
		if(src === this.src)
			return this;

		this.dataSource = dataSrc;
		this.src = src;

		return this.update();
	}
	update(): Dropdown
	{
		let i, L = this.component.selectEl.options.length - 1;
		for(i = L; i >= 0; i--)
			this.component.selectEl.remove(i);

		let match, target = this.src;
		while((match = /{(.+?)}/g.exec(target)) !== null)
			target = target.replace(match[0], this.dataSource[match[1]]);
		this.cache = Cache.cache(target);

		if(!this.src || !this.cache)
		{
			return this.value("").disable(true);
		}
		else
		{
			this.disable(false);
		}

		const keys = Object.keys(this.cache);

		for(i = 0; i < keys.length; i++)
			this.component.addOption(keys[i], keys[i]);

		return this.value("");
	}
	onChange(cb): Dropdown
	{
		this.component?.onChange(value => {
			if(this.hasDynamicDescription)
				this._changeDesc(value);

			if(this.linkedProperty !== undefined)
				this.linkSrc[this.linkedProperty] = value;

			cb(value);
		});

		return this;
	}
	private _changeDesc(value): void
	{
		this.desc("");
		if(value === undefined || value === "")
			return;
		else if(this.cache[value].hasOwnProperty("content"))
			MarkdownPreviewView.renderMarkdown(this.cache[value].content, this.descElmt);
		else
			MarkdownPreviewView.renderMarkdown(this.cache[value], this.descElmt);
	}
}
export class TextField extends VisualComponent {
	constructor(parent: HTMLElement, name: string)
	{
		super(parent, name);
		this.component = new TextComponent(this.compElmt);
		this.onChange(value => {});
	}
	onChange(cb): TextField
	{
		this.component?.onChange(value => {
			if(this.linkSrc && this.linkedProperty)
				this.linkSrc[this.linkedProperty] = value;

			cb(value);
		});

		return this;
	}
}
export class TextArea extends VisualComponent {
	constructor(parent: HTMLElement, name: string)
	{
		super(parent, name);
		this.compElmt.classList.add("character-builder-setting-text-area-control");
		this.component = new TextAreaComponent(this.compElmt);
		this.onChange(value => {});
	}
	onChange(cb): TextField
	{
		this.component?.onChange(value => {
			if(this.linkSrc && this.linkedProperty)
				this.linkSrc[this.linkedProperty] = value;

			cb(value);
		});

		return this;
	}
}
export class Slider extends VisualComponent {
	tooltipElmt: HTMLElement;
	showTooltip: boolean;
	constructor(parent: HTMLElement, name: string)
	{
		super(parent, name);
		this.tooltipElmt = this.compElmt.createSpan({ cls: "character-builder-slider-tooltip" });
		this.component = new SliderComponent(this.compElmt);
		this.onChange(value => {});
	}
	range(min: number, max: number, step: number): Slider
	{
		this.component.setLimits(min, max, step);

		return this;
	}
	tooltip(show: boolean): Slider
	{
		this.showTooltip = show;

		if(show)
			this.tooltipElmt.classList.remove("tooltip-hidden");
		else
			this.tooltipElmt.classList.add("tooltip-hidden");

		return this;
	}
	onChange(cb): Slider
	{
		this.component?.onChange(value => {
			if(this.linkSrc && this.linkedProperty)
				this.linkSrc[this.linkedProperty] = value;
			
			this.tooltipElmt.innerHTML = value;

			cb(value);
		});

		return this;
	}
}
