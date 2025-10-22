const { Resend } = require('resend');

/**
 * Create Resend client
 * Uses Resend API (HTTP-based, not SMTP) which works on all cloud platforms
 */
const createResendClient = () => {
  // Check if Resend API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY not configured. Email sending will be simulated.');
    console.warn('Get your API key at: https://resend.com/api-keys');
    return null;
  }

  return new Resend(process.env.RESEND_API_KEY);
};

/**
 * Validate Gmail address
 * @param {string} email - Email to validate
 */
const isGmailAddress = (email) => {
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
  return gmailRegex.test(email);
};

/**
 * Get the allowed recipient email for Resend test mode
 * When using onboarding@resend.dev, you can only send to the email used to create the Resend account
 */
const RESEND_TEST_EMAIL = 'iriteshreddy@gmail.com';

/**
 * Send newsletter email
 * @param {string} recipientEmail - Recipient's email address (must be Gmail)
 * @param {object} newsletterData - Newsletter content
 */
const sendNewsletterEmail = async (recipientEmail, newsletterData) => {
  // Validate Gmail address only
  if (!isGmailAddress(recipientEmail)) {
    throw new Error('Only Gmail addresses are supported. Please enter a valid @gmail.com address.');
  }

  const resend = createResendClient();

  // If no Resend client (missing API key), simulate sending
  if (!resend) {
    console.log(`📧 [SIMULATED] Email would be sent to: ${recipientEmail}`);
    return {
      success: true,
      message: 'Email simulated successfully (RESEND_API_KEY not configured)',
      simulated: true
    };
  }

  // Build HTML email
  const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1f2937;
      font-weight: 300;
      font-size: 28px;
      margin-bottom: 8px;
    }
    h2 {
      color: #374151;
      font-weight: 400;
      font-size: 18px;
      margin-top: 32px;
      margin-bottom: 12px;
    }
    p {
      color: #4b5563;
      line-height: 1.6;
      margin: 12px 0;
    }
    .header {
      border-bottom: 2px solid #1f2937;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .takeaway {
      background: #f3f4f6;
      padding: 16px;
      margin: 12px 0;
      border-left: 3px solid #1f2937;
      border-radius: 4px;
    }
    .article {
      border: 1px solid #e5e7eb;
      padding: 16px;
      margin: 12px 0;
      border-radius: 6px;
    }
    .article h3 {
      margin-top: 0;
      color: #1f2937;
      font-size: 16px;
    }
    .article-link {
      color: #2563eb;
      text-decoration: none;
      font-size: 14px;
    }
    .tip {
      background: #fef3c7;
      padding: 16px;
      border-radius: 6px;
      margin-top: 24px;
      border-left: 4px solid #f59e0b;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 14px;
    }
    .date {
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${newsletterData.headline}</h1>
      <p class="date">Generated on ${new Date(newsletterData.generatedAt).toLocaleString()}</p>
    </div>

    <div class="section">
      <h2>Market Overview</h2>
      <p>${newsletterData.marketOverview}</p>
    </div>

    <div class="section">
      <h2>Your Portfolio Insights</h2>
      <p>${newsletterData.portfolioInsights}</p>
    </div>

    <div class="section">
      <h2>Key Takeaways</h2>
      ${newsletterData.keyTakeaways.map(t => `<div class="takeaway">${t}</div>`).join('')}
    </div>

    ${newsletterData.featuredArticles && newsletterData.featuredArticles.length > 0 ? `
    <div class="section">
      <h2>Featured Articles</h2>
      ${newsletterData.featuredArticles.map(a => `
        <div class="article">
          <h3>${a.title}</h3>
          <p>${a.summary}</p>
          <p><strong>Why this matters:</strong> ${a.relevance}</p>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${newsletterData.articles && newsletterData.articles.length > 0 ? `
    <div class="section">
      <h2>Latest Market News</h2>
      ${newsletterData.articles.slice(0, 5).map(a => `
        <div class="article">
          <h3>${a.title}</h3>
          <p style="font-size: 14px; color: #6b7280;">${a.summary}</p>
          <a href="${a.url}" class="article-link" target="_blank">Read more →</a>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="tip">
      <h2 style="margin-top: 0; font-size: 16px;">💡 Learning Tip</h2>
      <p style="margin-bottom: 0;">${newsletterData.educationalTip}</p>
    </div>

    <div class="footer">
      <p>This newsletter is for educational purposes only.</p>
      <p>Paper Trading Simulator by Fin Coach</p>
    </div>
  </div>
</body>
</html>
  `;

  // Send email via Resend API
  try {
    const { data, error } = await resend.emails.send({
      from: 'Fin Coach Newsletter <onboarding@resend.dev>',
      to: recipientEmail,
      subject: `📈 ${newsletterData.headline}`,
      html: emailHTML,
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      throw new Error(`Resend API error: ${error.message}`);
    }

    console.log(`✅ Email sent successfully to ${recipientEmail}`);
    console.log(`Email ID: ${data.id}`);

    return {
      success: true,
      message: 'Email sent successfully',
      emailId: data.id
    };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = {
  sendNewsletterEmail
};
