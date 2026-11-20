import { InventoryEditorService } from './inventory-editor.service.js';
import { InventoryPublishService } from './inventory-publish.service.js';
import { SaveEditorDto, PublishListingDto } from './dto/inventory-editor.dto.js';
import type { EditorResponse } from './dto/inventory-editor.dto.js';
import { User } from '../auth/entities/user.entity.js';
export declare class InventoryEditorController {
    private readonly editor;
    private readonly publisher;
    constructor(editor: InventoryEditorService, publisher: InventoryPublishService);
    getEditor(id: string, user: User): Promise<EditorResponse>;
    saveEditor(id: string, dto: SaveEditorDto): Promise<{
        ok: boolean;
    }>;
    publishListing(id: string, user: User, body: PublishListingDto): Promise<import("./inventory-publish.service.js").PublishResult>;
}
