import { App, Modal, Setting, TFolder, normalizePath } from 'obsidian'

export class CreateNoteModal extends Modal {
    noteName: string = ''
    selectedFolder: TFolder | null = null
    folders: TFolder[] = []
    defaultFolder: string
    onSubmit: (noteName: string, folder: TFolder | null) => void

    constructor(app: App, defaultFolder: string, onSubmit: (noteName: string, folder: TFolder | null) => void) {
        super(app)
        this.defaultFolder = defaultFolder
        this.onSubmit = onSubmit
        this.loadFolders()
    }

    loadFolders(): void {
        const folders: TFolder[] = []
        const root = this.app.vault.getRoot()

        // Only collect top-level folders (direct children of root)
        for (const child of root.children) {
            if (child instanceof TFolder) {
                folders.push(child)
            }
        }

        this.folders = folders
    }

    onOpen(): void {
        const { contentEl } = this

        contentEl.createEl('h2', { text: 'Create New Note' })

        // Note name input
        new Setting(contentEl)
            .setName('Note name')
            .setDesc('Enter the name for your new note')
            .addText(text => {
                text
                    .setPlaceholder('My new note')
                    .setValue(this.noteName)
                    .onChange(value => {
                        this.noteName = value
                    })
                text.inputEl.focus()
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.submit()
                    }
                })
            })

        // Folder selection
        const folderSetting = new Setting(contentEl)
            .setName('Select folder')
            .setDesc('Choose a folder or leave as root')

        folderSetting.addDropdown(dropdown => {
            // Add root option
            dropdown.addOption('', '/ (Vault root)')

            // Add all folders
            this.folders.forEach(folder => {
                if (folder.path !== '/') {
                    dropdown.addOption(folder.path, folder.path)
                }
            })

            // Set default folder if specified
            if (this.defaultFolder) {
                const defaultFolderPath = normalizePath(this.defaultFolder)
                const folderExists = this.folders.some(f => f.path === defaultFolderPath)
                if (folderExists) {
                    dropdown.setValue(defaultFolderPath)
                    this.selectedFolder = this.app.vault.getAbstractFileByPath(defaultFolderPath) as TFolder
                }
            }

            dropdown.onChange(value => {
                if (value === '') {
                    this.selectedFolder = null
                } else {
                    this.selectedFolder = this.app.vault.getAbstractFileByPath(value) as TFolder
                }
            })
        })

        // Buttons
        new Setting(contentEl)
            .addButton(btn =>
                btn
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.close()
                    }))
            .addButton(btn =>
                btn
                    .setButtonText('Create')
                    .setCta()
                    .onClick(() => {
                        this.submit()
                    }))
    }

    submit(): void {
        if (this.noteName.trim() === '') {
            return
        }
        this.onSubmit(this.noteName, this.selectedFolder)
        this.close()
    }

    onClose(): void {
        const { contentEl } = this
        contentEl.empty()
    }
}
