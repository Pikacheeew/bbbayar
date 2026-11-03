export type CampaignStatus = "open" | "closed" | "completed";
export type ParticipantStatus = "joined" | "awaiting_payment" | "paid";
export type CampaignType = "pledge" | "sell";
export type ShippingMethod = "instant" | "jnt";

export interface DiscountTier {
  id: string;
  campaign_id: string;
  min_buyers: number;
  discount_percent: number;
}

export interface CampaignItem {
  id: string;
  campaign_id: string;
  name: string;
  price: number;
  sort_order: number;
}

export interface OrderItemLine {
  item_name: string;
  qty: number;
  unit_price: number;
}

export interface CampaignItemTotal {
  item_name: string;
  unit_price: number;
  total_qty: number;
  total_revenue: number;
}

export interface OrderItemRow extends OrderItemLine {
  participant_id: string;
}

export interface Campaign {
  id: string;
  organizer_id: string;
  title: string;
  product_url: string | null;
  campaign_type: CampaignType;
  total_amount: number | null;
  base_price: number | null;
  max_qty: number | null;
  reserve_minutes: number | null;
  origin_address: string | null;
  origin_city: string | null;
  origin_postal_code: string | null;
  requires_shipping: boolean;
  location_url: string | null;
  origin_latitude: number | null;
  origin_longitude: number | null;
  slots_taken: number;
  deadline: string;
  status: CampaignStatus;
  slug: string;
  created_at: string;
}

export interface CampaignPublic {
  id: string;
  title: string;
  product_url: string | null;
  image_url: string | null;
  campaign_type: CampaignType;
  total_amount: number | null;
  base_price: number | null;
  max_qty: number | null;
  origin_address: string | null;
  origin_city: string | null;
  origin_postal_code: string | null;
  requires_shipping: boolean;
  location_url: string | null;
  origin_latitude: number | null;
  origin_longitude: number | null;
  deadline: string;
  status: CampaignStatus;
  slug: string;
  slots_taken: number;
  paid_count: number;
  total_collected: number;
}

export interface Participant {
  id: string;
  campaign_id: string;
  name: string;
  phone: string;
  email: string | null;
  is_organizer: boolean;
  amount_due: number | null;
  qr_payload: string | null;
  status: ParticipantStatus;
  joined_at: string;
  paid_at: string | null;
  shipping_method: ShippingMethod | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_postal_code: string | null;
  shipping_fee: number;
  admin_fee: number;
  reserved_until: string | null;
  notes: string | null;
  order_summary?: string | null;
  shipping_latitude: number | null;
  shipping_longitude: number | null;
}

export interface ParticipantDetail extends Participant {
  campaign_slug: string;
  campaign_title: string;
  campaign_status: CampaignStatus;
  deadline: string;
  product_url: string | null;
  campaign_type: CampaignType;
  campaign_total_amount: number | null;
  campaign_base_price: number | null;
  campaign_max_qty: number | null;
  campaign_slots_taken: number;
  campaign_requires_shipping: boolean;
  campaign_origin_address: string | null;
  campaign_origin_city: string | null;
  campaign_origin_postal_code: string | null;
  campaign_location_url: string | null;
  campaign_origin_latitude: number | null;
  campaign_origin_longitude: number | null;
  order_items: OrderItemLine[];
}

export interface PledgeCampaign {
  id: string;
  slug: string;
  title: string;
  product_url: string | null;
  image_url: string | null;
  campaign_type: CampaignType;
  total_amount: number | null;
  base_price: number | null;
  max_qty: number | null;
  deadline: string;
  status: CampaignStatus;
  slots_taken: number;
  organizer_name: string | null;
  paid_count: number;
  total_collected: number;
}
