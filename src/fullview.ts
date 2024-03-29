export const VIEW_TYPE_CHARACTER_BUILDER_FULL = "character-builder-full-view";

import { ItemView, Setting, Notice } from 'obsidian';

import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { print } from 'src/builder.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { TabContainer } from 'src/tab.ts';
import { BaseTab } from 'src/tabs/basetab.ts';
import { RaceTab } from 'src/tabs/racetab.ts';
import { LevelTab } from 'src/tabs/leveltab.ts';

export class CharacterBuilderFullView extends ItemView {
	plugin: any;
	metadata: Metadata;
	file: TFile;
	name: string;

	tabContainer: TabContainer;

	constructor(leaf: WorkspaceLeaf, plugin: any) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CHARACTER_BUILDER_FULL;
	}

	getDisplayText(): string {
		return `${!!this.file ? 'Modification' : 'Création'} de ${this.name || this.metadata?.name || 'personnage'} - ${this.contentEl.querySelector(".character-builder-breadcrumb-tab:not(.tab-hidden)")?.children[0]?.textContent || 'Base du personnage'}`;
	}

	getState(): any {
		return { file: this.file?.path, metadata: this.metadata, tab: this.tabContainer.active };
	}

	async setState(state: any): void {
		this.file = this.plugin.app.vault.getAbstractFileByPath(state.file);
		this.metadata = state.metadata;

		if(this.file)
		{
			this.metadata = Object.assign({}, JSON.parse(JSON.stringify(this.app.metadataCache.getFileCache(this.file).frontmatter)), this.metadata);
			this.metadata.position = undefined;
			this.name = this.metadata.name;
		}
		if(!this.metadata)
		{
			this.metadata = {};
			this.metadata.statBlock = JSON.parse(JSON.stringify(StatBlock));
			this.metadata.substats = {};
			this.metadata.levels = [];
			this.metadata.race = {};
		}
		this.metadata.type = "character";

		this.plugin.loading.then(this.render.bind(this)).then(() => { if(state.tab) this.tabContainer.goto(state.tab, true) });
	}

	async onOpen(): void {
		const {contentEl} = this;

		contentEl.empty();
		const loading = contentEl.createDiv({ cls: "character-builder-loading-container" });
		loading.createSpan({ cls: "character-builder-loading-title" });
		loading.createSpan({ cls: "character-builder-loading-bar" });

		this.plugin.addTab(this);
	}

	render(): void
	{
		const {contentEl} = this;

		contentEl.empty();
		const header = contentEl.createDiv("character-builder-full-view-header");
		header.createEl("h2", { text: "Création de personnage" });

		this.tabContainer = new TabContainer(this.app, contentEl, header).cache(this);
		const baseTab = this.tabContainer.add(BaseTab, "Base du personnage").onOpen(() => this.refresh());
		const raceTab = this.tabContainer.add(RaceTab, "Race").onOpen(() => this.refresh());
		const levelsTab = this.tabContainer.add(LevelTab, "Niveaux").onOpen(() => this.refresh());

		new Setting(contentEl.createDiv("character-builder-full-view-footer")).addButton(btn => btn.setButtonText("Suivant").onClick(() => this.tabContainer.next())).addButton(btn => btn.setButtonText(this.file ? 'Modifier' : 'Créer').onClick(() => {
			if(!this.metadata.name || this.metadata.name.trim() === '')
			{
				new Notice("Veuillez saisir un nom pour créer la fiche de personnage.");
				return;
			}

			this.create();
		}));
	}

	refresh(force: boolean = false): void
	{
		this.tabContainer.render(force);
		this.updateDisplay();
		this.plugin.app.workspace.saveLayout();
	}

	updateDisplay(): void {
		this.app.workspace.updateTitle();
		this.leaf.updateHeader();
		this.titleEl.setText(this.getDisplayText());
	}

	async onClose(): void {
		this.plugin.removeTab(this);
	}

	async create(): void {
		const settings = Cache.cache("settings");
		const filepath = `${this.file ? this.file.parent.path : settings.charactersFolder}/${this.metadata.name}.md`;
		let templateData;
		try {
			templateData = await this.app.vault.read(this.app.vault.getAbstractFileByPath(settings.characterTemplate));
		} catch(e) {
			new Notice("Le template est introuvable.");
			return;
		}
		if(!templateData)
		{
			new Notice("Le template est introuvable.");
			return;
		}
		if(await this.app.vault.adapter.exists(filepath) && this.file && this.file.path !== filepath)
		{
			new Notice("Ce personnage existe déjà");
			return;
		}

		const content = `---\n${JSON.stringify(this.metadata)}\n---\n${print(this.metadata, templateData)}`;

		let file;
		if(this.file && this.file.basename !== this.metadata.name)
		{
			await this.app.vault.delete(this.file);
			file = await this.app.vault.create(filepath, content);
		}
		else if(this.file)
		{
			await this.app.vault.modify(this.file, content);
			file = this.file;
		}
		else if(!this.file)
		{
			file = await this.app.vault.create(filepath, content);
		}

		await this.leaf.openFile(file);
	}

	onPaneMenu(menu: Menu, source: string): void
	{
		super.onPaneMenu(menu, source);
		menu.addItem(item => {
			item.setTitle("Désactiver les restrictions").setChecked(!!this.metadata.freeMode).onClick(e => { this.metadata.freeMode = !this.metadata.freeMode; this.refresh(true); });
		});
	}
}
