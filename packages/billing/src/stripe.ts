import Stripe from 'stripe';

export interface BillingConfig {
  secretKey: string;
  webhookSecret: string;
  prices: {
    pro: string;
    enterprise: string;
  };
}

export interface CreateCheckoutParams {
  orgId: string;
  orgName: string;
  email: string;
  plan: 'pro' | 'enterprise';
  successUrl: string;
  cancelUrl: string;
}

export function createBillingService(config: BillingConfig) {
  const stripe = new Stripe(config.secretKey);

  return {
    // Create Stripe customer for org
    async createCustomer(orgId: string, email: string, name: string) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { orgId },
      });
      return customer;
    },

    // Create checkout session for subscription
    async createCheckoutSession(params: CreateCheckoutParams) {
      const priceId = params.plan === 'pro'
        ? config.prices.pro
        : config.prices.enterprise;

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: params.email,
        client_reference_id: params.orgId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          orgId: params.orgId,
          plan: params.plan,
        },
      });

      return session;
    },

    // Create billing portal session
    async createPortalSession(customerId: string, returnUrl: string) {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return session;
    },

    // Handle webhook events
    async handleWebhook(body: string, signature: string) {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        config.webhookSecret
      );

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          return {
            type: 'subscription_created' as const,
            orgId: session.metadata?.orgId,
            customerId: session.customer as string,
            subscriptionId: session.subscription as string,
            plan: session.metadata?.plan as 'pro' | 'enterprise',
          };
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          return {
            type: 'subscription_updated' as const,
            customerId: subscription.customer as string,
            subscriptionId: subscription.id,
            status: subscription.status,
          };
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          return {
            type: 'subscription_cancelled' as const,
            customerId: subscription.customer as string,
            subscriptionId: subscription.id,
          };
        }

        default:
          return { type: 'unhandled' as const, eventType: event.type };
      }
    },

    // Get subscription status
    async getSubscription(subscriptionId: string) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    },

    // Cancel subscription
    async cancelSubscription(subscriptionId: string) {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return subscription;
    },

    stripe,
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
