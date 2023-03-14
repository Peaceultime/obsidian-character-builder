import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';

export class LevelTab extends Tab
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

		
	}
}