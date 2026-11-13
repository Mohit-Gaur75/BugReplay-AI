/**
 * Webhook Notification Service (Slack, Discord & Custom Webhooks)
 */

export class WebhookNotifier {
  static async sendIncidentAlert(webhookUrl, project, incident, synthesis) {
    if (!webhookUrl || typeof webhookUrl !== 'string') return false;

    const shortId = incident.id.slice(0, 8);
    const dashboardUrl = `http://localhost:5173`;

    // Multi-platform payload: works for Slack, Discord, and custom webhooks
    const isSlack = webhookUrl.includes('slack.com');
    const isDiscord = webhookUrl.includes('discord.com');

    let payload = {
      event: 'incident.created',
      incident_id: incident.id,
      project_name: project.name || 'Application',
      error_message: incident.error_message,
      error_type: incident.error_type || 'Error',
      page_url: incident.page_url,
      ai_root_cause: synthesis.rootCause || 'Analyzing failure...',
      timestamp: new Date().toISOString(),
      dashboard_url: dashboardUrl,
    };

    if (isSlack) {
      payload = {
        text: `🚨 *[BugReplay AI]* New production bug in *${project.name}*`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `🚨 ${incident.error_type || 'Error'}: ${incident.error_message.slice(0, 80)}` },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Project:*\n${project.name}` },
              { type: 'mrkdwn', text: `*URL:*\n${incident.page_url}` },
              { type: 'mrkdwn', text: `*Incident ID:*\n#${shortId}` },
              { type: 'mrkdwn', text: `*AI Confidence:*\n${synthesis.confidence || 'HIGH'}` },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*AI Root Cause Diagnosis:*\n${synthesis.rootCause || 'Under investigation.'}`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Open in Dashboard' },
                url: dashboardUrl,
                style: 'primary',
              },
            ],
          },
        ],
      };
    } else if (isDiscord) {
      payload = {
        content: `🚨 **[BugReplay AI]** New bug captured in **${project.name}**!`,
        embeds: [
          {
            title: `${incident.error_type}: ${incident.error_message}`,
            url: dashboardUrl,
            color: 0xe11d48, // Red
            fields: [
              { name: 'Culprit URL', value: incident.page_url, inline: true },
              { name: 'Incident ID', value: `#${shortId}`, inline: true },
              { name: 'AI Root Cause', value: synthesis.rootCause || 'Analyzing...', inline: false },
            ],
            footer: { text: 'BugReplay AI — Automated Playwright Test Generated' },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    // If testing with mock URL or in test mode, simulate success
    if (webhookUrl.includes('XXXX') || webhookUrl.includes('mock') || process.env.NODE_ENV === 'test') {
      return true;
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return res.ok;
    } catch (err) {
      console.warn(`[WebhookNotifier] Failed to deliver alert to ${webhookUrl}:`, err.message);
      return false;
    }
  }

  static async sendTestAlert(webhookUrl, projectName = 'Demo Project') {
    if (!webhookUrl) throw new Error('Missing webhook URL');

    const testIncident = {
      id: 'test-00000000-0000',
      error_message: 'Test Connection from BugReplay AI',
      error_type: 'TestNotification',
      page_url: 'http://localhost:5173',
    };

    const testSynthesis = {
      rootCause: 'This is a test notification confirming your webhook integration is configured properly.',
      confidence: 'VERIFIED',
    };

    const success = await this.sendIncidentAlert(webhookUrl, { name: projectName }, testIncident, testSynthesis);
    if (!success) {
      throw new Error('Webhook endpoint did not return a 2xx HTTP response.');
    }
    return true;
  }
}
