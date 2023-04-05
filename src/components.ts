import { TextComponent, TextAreaComponent, DropdownComponent, SliderComponent, ValueComponent, MarkdownPreviewView } from 'obsidian';

import { CharacterBuilderCache as Cache, reach } from 'src/cache.ts';

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
		if(this.component?.getValue() === value)
			return this;

		this.component?.setValue(value?.toString());
		this.component?.changeCallback(value);

		return this;
	}
	disable(state: boolean): VisualComponent
	{
		this.component?.setDisabled(state);

		return this;
	}
	validate(): boolean
	{
		this.setting.classList.remove("invalid");
		const value = this.component?.getValue();
		if(value !== '' && value !== undefined && value !== null && this.compElmt.querySelector("input,select,textarea")?.checkValidity())
			return true;

		this.setting.classList.add("invalid");
		return false;
	}
	required(tab: Tab): VisualComponent
	{
		tab.required(this);

		return this;
	}

	onChange(cb): VisualComponent
	{
		this.component?.onChange(value => {
			this.setting.classList.remove("invalid");

			if(this.linkSrc && this.linkedProperty)
				this.linkSrc[this.linkedProperty] = value;

			cb(value);
		});

		return this;
	}
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
		if(src && src === this.src)
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

		if(!this.src && this.dataSource)
		{
			this.cache = this.dataSource;
		}
		else if(this.dataSource && this.src)
		{
			let match, target = this.src;
			target = target.replace(/{(.+?)}/g, (_, m1) => reach(this.dataSource, m1));
			this.cache = Cache.cache(target);
		}
		else
		{
			this.cache = undefined;
		}

		if(!this.cache)
		{
			return this.value("").disable(true);
		}
		else
		{
			this.disable(false);
		}

		let keys, values;
		if(Array.isArray(this.cache))
		{
			keys = this.cache;
			values = this.cache;
		}
		else if(this.hasDynamicDescription)
		{
			keys = Object.keys(this.cache);
			values = Object.keys(this.cache);
		}
		else if(Object.values(this.cache).every(e => typeof e === "string" || typeof e === "number"))
		{
			keys = Object.values(this.cache);
			values = Object.keys(this.cache);
		}
		else
		{
			keys = Object.keys(this.cache);
			values = Object.keys(this.cache);
		}

		for(i = 0; i < keys.length; i++)
			this.component.addOption(values[i], keys[i]);

		return this.value("");
	}
	onChange(cb): Dropdown
	{
		this.component?.onChange(value => {
			this.setting.classList.remove("invalid");
			
			if(this.hasDynamicDescription && this.cache)
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
		else if(this.cache[value] && this.cache[value].hasOwnProperty("content"))
			MarkdownPreviewView.renderMarkdown(this.cache[value].content, this.descElmt);
		else if(this.cache[value])
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
}
export class TextArea extends VisualComponent {
	constructor(parent: HTMLElement, name: string)
	{
		super(parent, name);
		this.compElmt.classList.add("character-builder-setting-text-area-control");
		this.component = new TextAreaComponent(this.compElmt);
		this.onChange(value => {});
	}
}
export class Slider extends VisualComponent {
	tooltipElmt: HTMLElement;
	showTooltip: boolean;
	dynamicTooltip: boolean;
	constructor(parent: HTMLElement, name: string, dynamicTooltip: boolean = true)
	{
		super(parent, name);
		this.tooltipElmt = this.compElmt.createSpan({ cls: "character-builder-slider-tooltip" });
		this.component = new SliderComponent(this.compElmt);
		this.onChange(value => {});
	}
	range(min: number, max: number, step: number): Slider
	{
		this.component.setLimits(min, max, step);
		
		if(this.dynamicTooltip) this.tooltipElmt.innerHTML = this.component?.getValue();

		return this;
	}
	tooltip(show: boolean | number): Slider
	{
		if(typeof show === "boolean")
		{
			this.showTooltip = show;
			this.dynamicTooltip = true;
			if(show)
				this.tooltipElmt.classList.remove("tooltip-hidden");
			else
				this.tooltipElmt.classList.add("tooltip-hidden");
		}
		else
		{
			this.showTooltip = true;
			this.dynamicTooltip = false;
			this.tooltipElmt.innerHTML = show;
		}

		return this;
	}
	onChange(cb): Slider
	{
		this.component?.onChange(value => {
			if(this.linkSrc && this.linkedProperty)
				this.linkSrc[this.linkedProperty] = value;
			
			if(this.dynamicTooltip) this.tooltipElmt.innerHTML = value;

			cb(value);
		});

		return this;
	}
}
export class MarkdownArea extends VisualComponent {
	editor: any;
	constructor(parent: HTMLElement, name: string)
	{
		super(parent, name);
		this.compElmt.classList.add("character-builder-setting-markdown-area-control");
		this.component = undefined;
		this.editor = app.embedRegistry.getEmbedCreator({ extension: "md" })({
		    app: app,
		    linktext: null,
		    sourcePath: null,
		    containerEl: this.compElmt,
		    displayMode: false,
		    showInline: false,
		    depth: 0
		}, null);
		this.editor.editable = true;
		this.editor.load();
		this.editor.showEditor();
		this.editor.inlineTitleEl?.remove();
		this.onChange(value => {});
	}
	/* override */
	value(value: string): VisualComponent
	{
		this.editor?.set(value?.toString() || '');

		return this;
	}
	/* override */
	disable(state: boolean): VisualComponent
	{
		if(state)
			this.editor.showPreview();
		else
			this.editor.showEditor();

		this.editor.inlineTitleEl?.remove();
		return this;
	}
	/* override */
	onChange(cb): VisualComponent
	{	
		this.editor.requestSave = () => {
			const value = this.editor.text;
			this.setting.classList.remove("invalid");

			if(this.linkSrc && this.linkedProperty)
				this.linkSrc[this.linkedProperty] = value;

			cb(value);
		}

		return this;
	}
}
