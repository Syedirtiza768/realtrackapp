import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service.js';

/**
 * Listens to cross-module events and creates notifications.
 * Other modules emit events via EventEmitter2; this service
 * translates them into user-visible notifications.
 */
@Injectable()
export class NotificationTriggers {
  private readonly logger = new Logger(NotificationTriggers.name);

  constructor(private readonly notifService: NotificationsService) {}

  /* ─── Module 2: Ingestion ─── */

  @OnEvent('ingestion.completed')
  async onIngestionComplete(data: { jobId: string; title?: string }) {
    await this.notifService.create({
      type: 'ingestion_complete',
      title: 'Ingestion Complete',
      body: data.title
        ? `AI processing finished for "${data.title}"`
        : 'AI ingestion job completed successfully',
      icon: 'check-circle',
      severity: 'success',
      entityType: 'ingestion_job',
      entityId: data.jobId,
      actionUrl: `/ingestion`,
    });
  }

  @OnEvent('ingestion.failed')
  async onIngestionFailed(data: { jobId: string; error?: string }) {
    await this.notifService.create({
      type: 'ingestion_failed',
      title: 'Ingestion Failed',
      body: data.error ?? 'AI ingestion job encountered an error',
      icon: 'x-circle',
      severity: 'error',
      entityType: 'ingestion_job',
      entityId: data.jobId,
      actionUrl: `/ingestion`,
    });
  }

  @OnEvent('ingestion.review_needed')
  async onReviewNeeded(data: { jobId: string; confidence?: number }) {
    await this.notifService.create({
      type: 'ai_review_needed',
      title: 'AI Review Required',
      body: data.confidence
        ? `Low confidence (${(data.confidence * 100).toFixed(0)}%) — manual review needed`
        : 'AI result requires human review',
      icon: 'eye',
      severity: 'warning',
      entityType: 'ingestion_job',
      entityId: data.jobId,
      actionUrl: `/ingestion`,
    });
  }

  /* ─── Module 4: Channels ─── */

  @OnEvent('channel.connected')
  async onChannelConnected(data: { channel: string; connectionId: string }) {
    await this.notifService.create({
      type: 'channel_connected',
      title: `${data.channel} Connected`,
      body: `Marketplace channel ${data.channel} connected successfully`,
      icon: 'link',
      severity: 'success',
      entityType: 'channel',
      entityId: data.connectionId,
    });
  }

  @OnEvent('channel.error')
  async onChannelError(data: { channel: string; connectionId: string; error?: string }) {
    await this.notifService.create({
      type: 'channel_error',
      title: `${data.channel} Error`,
      body: data.error ?? `Error with ${data.channel} connection`,
      icon: 'alert-triangle',
      severity: 'error',
      entityType: 'channel',
      entityId: data.connectionId,
    });
  }

  @OnEvent('listing.published')
  async onListingPublished(data: { listingId: string; channel: string; title?: string }) {
    await this.notifService.create({
      type: 'listing_published',
      title: 'Listing Published',
      body: `"${data.title ?? 'Listing'}" published to ${data.channel}`,
      icon: 'upload-cloud',
      severity: 'success',
      entityType: 'listing',
      entityId: data.listingId,
      actionUrl: `/catalog`,
    });
  }

  /* ─── Module 5: Inventory ─── */

  @OnEvent('inventory.low_stock')
  async onLowStock(data: { listingId: string; title?: string; available: number; threshold: number }) {
    await this.notifService.create({
      type: 'low_stock',
      title: 'Low Stock Alert',
      body: `"${data.title ?? 'Item'}" has ${data.available} left (threshold: ${data.threshold})`,
      icon: 'alert-triangle',
      severity: 'warning',
      entityType: 'listing',
      entityId: data.listingId,
      actionUrl: `/catalog`,
    });
  }

  @OnEvent('inventory.out_of_stock')
  async onOutOfStock(data: { listingId: string; title?: string }) {
    await this.notifService.create({
      type: 'out_of_stock',
      title: 'Out of Stock',
      body: `"${data.title ?? 'Item'}" is out of stock`,
      icon: 'package-x',
      severity: 'error',
      entityType: 'listing',
      entityId: data.listingId,
      actionUrl: `/catalog`,
    });
  }

  /* ─── Module 8: Orders ─── */

  @OnEvent('order.new')
  async onNewOrder(data: { orderId: string; channel: string; total?: string }) {
    await this.notifService.create({
      type: 'new_order',
      title: 'New Order',
      body: data.total
        ? `New ${data.channel} order — $${data.total}`
        : `New order received from ${data.channel}`,
      icon: 'shopping-cart',
      severity: 'info',
      entityType: 'order',
      entityId: data.orderId,
      actionUrl: `/orders`,
    });
  }

  @OnEvent('order.shipped')
  async onOrderShipped(data: { orderId: string; trackingNumber?: string }) {
    await this.notifService.create({
      type: 'order_shipped',
      title: 'Order Shipped',
      body: data.trackingNumber
        ? `Order shipped — tracking: ${data.trackingNumber}`
        : 'Order has been shipped',
      icon: 'truck',
      severity: 'success',
      entityType: 'order',
      entityId: data.orderId,
      actionUrl: `/orders`,
    });
  }

  /* ─── System ─── */

  @OnEvent('system.alert')
  async onSystemAlert(data: { title: string; body?: string; severity?: 'info' | 'warning' | 'error' }) {
    await this.notifService.create({
      type: 'system_alert',
      title: data.title,
      body: data.body,
      icon: 'info',
      severity: data.severity ?? 'info',
    });
  }
}
