import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;

    constructor(app: App, message: string, onConfirm: () => void, onCancel?: () => void) {
        super(app);
        this.message = message;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel || (() => {}); // Default to no-op if cancel is ignored
    }

    onOpen() {
        const { contentEl } = this;

        // Set the title or message
        contentEl.createEl('h2', { text: 'Confirm Action' });
        contentEl.createEl('p', { text: this.message });

        // Create buttons container
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                    this.onCancel();
                }))
            .addButton(btn => btn
                .setButtonText('Confirm')
                .setCta() // Makes the button prominent (primary color)
                .onClick(() => {
                    this.close();
                    this.onConfirm();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
