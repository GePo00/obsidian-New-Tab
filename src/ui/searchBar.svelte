<script lang="ts">
	import { Platform, normalizePath, Notice, TFile, Modal, App, TFolder, TAbstractFile } from "obsidian";
	import { filterKeys, type FilterKey, type SearchBarFilterType } from "src/homeTabSearchbar";
    import type HomeTabSearchBar from "src/homeTabSearchbar";
    import { pluginSettingsStore } from "src/store";
    import type { HomeTabSettings } from "src/settings";

    export let HomeTabSearchBar: HomeTabSearchBar
    export let embedded: boolean = false
    const searchBarEl = HomeTabSearchBar.searchBarEl
    const activeExtEl = HomeTabSearchBar.activeExtEl
    const container = HomeTabSearchBar.suggestionContainerEl
    // @ts-ignore
    const isPhone = Platform.isPhone

    let inputValue = ''
    let pluginSettings: HomeTabSettings

    pluginSettingsStore.subscribe((settings) => {
        pluginSettings = settings
    })

    function handleKeydown(e: KeyboardEvent): void{
        // If the input field is empty and a filter is active remove it
        if(e.key === 'Backspace'){
            if(inputValue != '') return
            if(HomeTabSearchBar.activeFilter){
                HomeTabSearchBar.updateActiveSuggester('default')
                // this.fileSuggester = new HomeTabFileSuggester(this.plugin.app, this.plugin, this.view, this)
                // this.fuzzySearch.updateSearchArray(this.files)
                // this.activeFilterEl.toggleClass('hide', true)
            }
        }

        if(e.key === 'Tab'){
            e.preventDefault()
            const key = inputValue.toLowerCase()
            // Activate search filter with tab
            if(filterKeys.find(item => item === key)){
                HomeTabSearchBar.updateActiveSuggester(key as FilterKey)
            }
        }
    }

    async function createNewNote(): Promise<void> {
        console.log('Create new note button clicked')

        const fileName = await promptForFileName()
        if (!fileName) {
            console.log('No filename provided')
            return
        }

        console.log('Creating note:', fileName)

        const selectedFolder = await promptForFolder()

        // If cancelled (null), use default folder from settings
        let folder: string
        if (selectedFolder === null) {
            console.log('Folder selection cancelled, using default folder')
            folder = pluginSettings.createNoteDefaultFolder
                ? normalizePath(pluginSettings.createNoteDefaultFolder)
                : app.fileManager.getNewFileParent('').path
        } else {
            folder = selectedFolder
        }

        console.log('Using folder:', folder)

        try {

            // Ensure folder exists
            if (folder) {
                const folderExists = await app.vault.adapter.exists(folder)
                if (!folderExists) {
                    await app.vault.createFolder(folder)
                }
            }

            const filePath = normalizePath(folder ? `${folder}/${fileName}.md` : `${fileName}.md`)

            // Check if file already exists
            const fileExists = await app.vault.adapter.exists(filePath)
            if (fileExists) {
                new Notice(`File "${fileName}.md" already exists`)
                return
            }

            // Create the file
            const file = await app.vault.create(filePath, '')

            // Open the file
            const leaf = app.workspace.getLeaf(false)
            await leaf.openFile(file)

            new Notice(`Created new note: ${fileName}`)
        } catch (error) {
            console.error('Error creating new note:', error)
            new Notice('Failed to create new note')
        }
    }

    class CreateNoteModal extends Modal {
        result: string | null = null
        onSubmit: (result: string | null) => void

        constructor(app: App, onSubmit: (result: string | null) => void) {
            super(app)
            this.onSubmit = onSubmit
        }

        onOpen() {
            const { contentEl, titleEl } = this
            titleEl.setText('Create new note')

            const inputContainer = contentEl.createDiv()
            inputContainer.style.marginBottom = '15px'

            const input = inputContainer.createEl('input', {
                type: 'text',
                placeholder: 'Enter note name...'
            })
            input.style.width = '100%'
            input.style.padding = '8px'
            input.addClass('prompt-input')

            const buttonContainer = contentEl.createDiv()
            buttonContainer.style.display = 'flex'
            buttonContainer.style.justifyContent = 'flex-end'
            buttonContainer.style.gap = '10px'

            const createButton = buttonContainer.createEl('button', {
                text: 'Create'
            })
            createButton.addClass('mod-cta')

            const cancelButton = buttonContainer.createEl('button', {
                text: 'Cancel'
            })

            createButton.addEventListener('click', () => {
                this.result = input.value.trim()
                this.close()
            })

            cancelButton.addEventListener('click', () => {
                this.result = null
                this.close()
            })

            input.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    this.result = input.value.trim()
                    this.close()
                } else if (e.key === 'Escape') {
                    this.result = null
                    this.close()
                }
            })

            // Focus input after a brief delay to ensure modal is fully rendered
            setTimeout(() => input.focus(), 50)
        }

        onClose() {
            const { contentEl } = this
            contentEl.empty()
            this.onSubmit(this.result)
        }
    }

    async function promptForFileName(): Promise<string | null> {
        return new Promise((resolve) => {
            new CreateNoteModal(app, resolve).open()
        })
    }

    class FolderSelectorModal extends Modal {
        result: string | null = null
        onSubmit: (result: string | null) => void
        folders: TFolder[]
        filteredFolders: TFolder[]
        selectedIndex: number = 0
        listEl: HTMLElement
        searchInput: HTMLInputElement

        constructor(app: App, onSubmit: (result: string | null) => void) {
            super(app)
            this.onSubmit = onSubmit
            this.folders = this.getAllFolders()
            this.filteredFolders = [...this.folders]
        }

        getAllFolders(): TFolder[] {
            const folders: TFolder[] = []
            const rootFolder = app.vault.getRoot()

            const collectFolders = (folder: TFolder) => {
                folders.push(folder)
                for (const child of folder.children) {
                    if (child instanceof TFolder) {
                        collectFolders(child)
                    }
                }
            }

            collectFolders(rootFolder)
            console.log('Found folders:', folders.length, folders.map(f => f.path))
            return folders.sort((a, b) => a.path.localeCompare(b.path))
        }

        onOpen() {
            const { contentEl, titleEl } = this
            titleEl.setText('Select folder for new note')

            // Search input
            const searchContainer = contentEl.createDiv({ cls: 'folder-search-container' })
            searchContainer.style.marginBottom = '10px'

            this.searchInput = searchContainer.createEl('input', {
                type: 'text',
                placeholder: 'Search folders...'
            })
            this.searchInput.style.width = '100%'
            this.searchInput.style.padding = '8px'
            this.searchInput.addClass('prompt-input')

            this.searchInput.addEventListener('input', () => {
                this.filterFolders()
            })

            this.searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredFolders.length - 1)
                    this.updateSelection()
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    this.selectedIndex = Math.max(this.selectedIndex - 1, 0)
                    this.updateSelection()
                } else if (e.key === 'Enter') {
                    e.preventDefault()
                    this.selectFolder(this.filteredFolders[this.selectedIndex])
                } else if (e.key === 'Escape') {
                    this.result = null
                    this.close()
                }
            })

            // Folder list
            const listContainer = contentEl.createDiv({ cls: 'folder-list-container' })
            listContainer.style.maxHeight = '300px'
            listContainer.style.overflowY = 'auto'
            listContainer.style.marginBottom = '15px'
            listContainer.style.border = '1px solid var(--background-modifier-border)'
            listContainer.style.borderRadius = 'var(--radius-s)'
            listContainer.style.pointerEvents = 'auto'

            this.listEl = listContainer

            // Buttons
            const buttonContainer = contentEl.createDiv()
            buttonContainer.style.display = 'flex'
            buttonContainer.style.justifyContent = 'space-between'
            buttonContainer.style.gap = '10px'

            const infoTextContainer = buttonContainer.createDiv()
            infoTextContainer.style.display = 'flex'
            infoTextContainer.style.flexDirection = 'column'
            infoTextContainer.style.alignSelf = 'center'
            infoTextContainer.style.gap = '2px'

            const infoText = infoTextContainer.createEl('span', {
                text: 'Click a folder or use arrows + Enter'
            })
            infoText.style.color = 'var(--text-muted)'
            infoText.style.fontSize = 'var(--font-ui-smaller)'

            const infoText2 = infoTextContainer.createEl('span', {
                text: 'Click Default to select default folder'
            })
            infoText2.style.color = 'var(--text-muted)'
            infoText2.style.fontSize = 'var(--font-ui-smaller)'

            const buttonsRight = buttonContainer.createDiv()
            buttonsRight.style.display = 'flex'
            buttonsRight.style.gap = '10px'

            const selectButton = buttonsRight.createEl('button', {
                text: 'Select'
            })
            selectButton.addClass('mod-cta')

            const cancelButton = buttonsRight.createEl('button', {
                text: 'Default'
            })

            selectButton.addEventListener('mousedown', (e) => {
                e.preventDefault()
                e.stopPropagation()
            })

            selectButton.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('Select button clicked')
                if (this.filteredFolders.length > 0) {
                    this.selectFolder(this.filteredFolders[this.selectedIndex])
                }
            })

            cancelButton.addEventListener('mousedown', (e) => {
                e.preventDefault()
                e.stopPropagation()
            })

            cancelButton.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('Cancel button clicked')
                this.result = null
                this.close()
            })

            this.renderFolderList()

            // Focus search input after a brief delay
            setTimeout(() => this.searchInput.focus(), 50)
        }

        filterFolders() {
            const query = this.searchInput.value.toLowerCase()
            if (!query) {
                this.filteredFolders = [...this.folders]
            } else {
                this.filteredFolders = this.folders.filter(folder =>
                    folder.path.toLowerCase().includes(query)
                )
            }
            this.selectedIndex = 0
            this.renderFolderList()
        }

        renderFolderList() {
            this.listEl.empty()

            console.log('Rendering folder list, filtered folders:', this.filteredFolders.length)

            if (this.filteredFolders.length === 0) {
                const emptyEl = this.listEl.createDiv({ cls: 'folder-list-item' })
                emptyEl.style.padding = '10px'
                emptyEl.style.color = 'var(--text-muted)'
                emptyEl.textContent = 'No folders found'
                return
            }

            this.filteredFolders.forEach((folder, index) => {
                const itemEl = this.listEl.createDiv({ cls: 'folder-list-item' })
                itemEl.style.padding = '8px 12px'
                itemEl.style.cursor = 'pointer'
                itemEl.style.borderRadius = 'var(--radius-s)'
                itemEl.style.userSelect = 'none'
                itemEl.style.transition = 'background-color 0.1s'
                itemEl.style.pointerEvents = 'auto'

                if (index === this.selectedIndex) {
                    itemEl.style.backgroundColor = 'var(--background-modifier-hover)'
                }

                const displayPath = folder.path === '/' ? '📁 Root folder' : `📁 ${folder.path}`
                itemEl.textContent = displayPath

                itemEl.addEventListener('mouseenter', () => {
                    this.selectedIndex = index
                    this.updateSelection()
                })

                // Use mousedown instead of click - it fires earlier and is less likely to be blocked
                itemEl.addEventListener('mousedown', (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('Folder mousedown:', folder.path)

                    // Set a small timeout to ensure the event is processed
                    setTimeout(() => {
                        this.selectFolder(folder)
                    }, 10)
                })

                // Keep click as backup
                itemEl.addEventListener('click', (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('Folder clicked (backup):', folder.path)
                })
            })
        }

        updateSelection() {
            this.renderFolderList()
            // Scroll selected item into view
            const items = this.listEl.querySelectorAll('.folder-list-item')
            if (items[this.selectedIndex]) {
                items[this.selectedIndex].scrollIntoView({ block: 'nearest' })
            }
        }

        selectFolder(folder: TFolder) {
            console.log('Selecting folder:', folder.path)
            this.result = folder.path === '/' ? '' : folder.path
            console.log('Result set to:', this.result)
            this.close()
        }

        onClose() {
            const { contentEl } = this
            contentEl.empty()
            this.onSubmit(this.result)
        }
    }

    async function promptForFolder(): Promise<string | null> {
        return new Promise((resolve) => {
            new FolderSelectorModal(app, resolve).open()
        })
    }

</script>

<div class="home-tab-searchbar-container" bind:this={$container}>
    {#if pluginSettings?.showCreateNoteButton && !embedded}
        <div class="home-tab-create-note-button-container">
            <button
                type="button"
                class="home-tab-create-note-button"
                on:click|stopPropagation={createNewNote}
                on:mousedown|stopPropagation>
                Create new note
            </button>
        </div>
    {/if}

    <div class="home-tab-searchbar"
        class:embedded={embedded}
        style:width={embedded || isPhone ? "90%" : "50%"}>
        <div class='nav-file-tag home-tab-suggestion-file-tag hide' bind:this={$activeExtEl}></div>
        <input type="search" spellcheck="false" placeholder="Type to start search..." bind:value={inputValue} bind:this={$searchBarEl}
        on:keydown={(e) => handleKeydown(e)}>
    </div>
</div>

<style>
    .home-tab-searchbar-container{
        display: flex;
        align-items: center;
        flex-direction: column;
    }

    .home-tab-create-note-button-container{
        display: flex;
        justify-content: center;
        width: 100%;
        margin-bottom: 15px;
    }

    .home-tab-searchbar{
        display: flex;
        /* width: 50%; */
        min-width: 250px;
        max-width: 700px;
        margin: 0 auto;

        height: calc(var(--input-height)*1.25);

        background-color: var(--background-modifier-form-field);
        border: var(--input-border-width) solid var(--background-modifier-border);
        padding: var(--size-2-3);
        border-radius: var(--input-radius);
        outline: none;
    }

    .home-tab-searchbar input{
        width: 100%;
        height: 100%;
        box-shadow: none;
        font-size: var(--font-ui-medium);
        background: none;
        border: none;
        padding-left: 12px;
    }
    .home-tab-searchbar input:hover{
        background: none;
        border: none;
    }

    .home-tab-suggestion-file-tag.hide{
        display: none;
    }

    .home-tab-create-note-button{
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 20px;
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: var(--button-radius);
        cursor: pointer;
        transition: all 0.2s;
        font-size: var(--font-ui-medium);
        font-weight: 500;
        pointer-events: auto;
        z-index: 1;
    }

    .home-tab-create-note-button:hover{
        background-color: var(--interactive-accent-hover);
    }

    .home-tab-create-note-button:active{
        transform: scale(0.95);
    }
</style>

<!--     .home-tab-searchbar{
        display: flex;
        align-items: center;
        justify-content: center;
        height: calc(var(--input-height)*1.25);
    }

    .home-tab-searchbar input{
        width: 50%;
        min-width: 250px;
        max-width: 700px;
        display: inline-block;
        margin: 0 auto;
        height: 100%;
        box-shadow: none;
        padding: 6px 18px;
        font-size: var(--font-ui-medium);
    }

    .home-tab-searchbar input:focus, .home-tab-searchbar input:active{
        border-color: var(--background-modifier-border);
    }
 -->