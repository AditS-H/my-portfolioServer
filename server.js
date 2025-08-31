


require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  contentSecurityPolicy: false, // Allow for better email HTML rendering
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5173','https://adit-portfolio-psi.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));



// Add this temporary debug endpoint to your server.js file
// This will help us diagnose the email configuration issue

// Add this route BEFORE your existing routes in server.js
app.get('/api/debug', async (req, res) => {
  try {
    console.log('🔍 Starting email configuration debug...');
    
    // Check environment variables
    const envCheck = {
      EMAIL_USER: !!process.env.EMAIL_USER,
      EMAIL_PASS: !!process.env.EMAIL_PASS,
      WORK_EMAIL: !!process.env.WORK_EMAIL,
      EMAIL_USER_VALUE: process.env.EMAIL_USER || 'NOT SET',
      WORK_EMAIL_VALUE: process.env.WORK_EMAIL || 'NOT SET',
      EMAIL_PASS_LENGTH: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
    };
    
    console.log('📧 Environment Variables Check:', envCheck);
    
    // Test transporter creation
    let transporterStatus = 'OK';
    let transporterError = null;
    
    try {
      const nodemailer = require('nodemailer');
      const testTransporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        secure: true,
        requireTLS: true,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      });
      
      console.log('🔧 Transporter created successfully');
      
      // Test verification
      console.log('🔍 Testing email verification...');
      await testTransporter.verify();
      console.log('✅ Email verification successful');
      
    } catch (error) {
      transporterStatus = 'ERROR';
      transporterError = error.message;
      console.error('❌ Transporter error:', error);
    }
    
    // Test email sending with minimal config
    let emailTestStatus = 'SKIPPED';
    let emailTestError = null;
    
    if (transporterStatus === 'OK') {
      try {
        console.log('📨 Testing actual email send...');
        const nodemailer = require('nodemailer');
        const testTransporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        
        const testMailOptions = {
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER, // Send to yourself for testing
          subject: 'Test Email - Debug',
          text: 'This is a test email from your contact form debug endpoint.'
        };
        
        await testTransporter.sendMail(testMailOptions);
        emailTestStatus = 'SUCCESS';
        console.log('✅ Test email sent successfully');
        
      } catch (error) {
        emailTestStatus = 'ERROR';
        emailTestError = error.message;
        console.error('❌ Email send error:', error);
      }
    }
    
    const debugResult = {
      success: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      transporter: {
        status: transporterStatus,
        error: transporterError
      },
      emailTest: {
        status: emailTestStatus,
        error: emailTestError
      },
      recommendations: []
    };
    
    // Add recommendations based on findings
    if (!envCheck.EMAIL_USER) {
      debugResult.recommendations.push('❌ EMAIL_USER environment variable is missing');
    }
    
    if (!envCheck.EMAIL_PASS) {
      debugResult.recommendations.push('❌ EMAIL_PASS environment variable is missing');
    }
    
    if (envCheck.EMAIL_PASS_LENGTH < 16) {
      debugResult.recommendations.push('⚠️ EMAIL_PASS seems too short for Gmail App Password (should be 16 characters)');
    }
    
    if (transporterStatus === 'ERROR') {
      if (transporterError.includes('Invalid login')) {
        debugResult.recommendations.push('❌ Invalid Gmail credentials - check your EMAIL_USER and EMAIL_PASS');
      }
      if (transporterError.includes('Username and Password not accepted')) {
        debugResult.recommendations.push('❌ Gmail rejected credentials - ensure 2FA is enabled and you\'re using App Password');
      }
    }
    
    if (debugResult.recommendations.length === 0) {
      debugResult.recommendations.push('✅ Configuration looks good!');
    }
    
    res.json(debugResult);
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Debug endpoint failed',
      details: error.message
    });
  }
});

// Also add this improved error logging to your existing /api/contact route
// Replace the catch block in your contact route with this:

/*
} catch (error) {
  console.error('❌ Contact form error details:');
  console.error('   Error name:', error.name);
  console.error('   Error message:', error.message);
  console.error('   Error code:', error.code);
  console.error('   Error stack:', error.stack);
  
  // Provide specific error messages based on error type
  let errorMessage = 'Failed to send message. Please try again later.';
  
  if (error.code === 'EAUTH') {
    errorMessage = 'Email authentication failed. Please contact support.';
    console.error('   🔧 Fix: Check EMAIL_USER and EMAIL_PASS in .env file');
  } else if (error.code === 'ECONNECTION') {
    errorMessage = 'Connection failed. Please check your internet connection and try again.';
    console.error('   🔧 Fix: Check internet connection and Gmail service status');
  } else if (error.code === 'ETIMEDOUT') {
    errorMessage = 'Request timed out. Please try again.';
    console.error('   🔧 Fix: Try again or check network connection');
  } else if (error.message.includes('Invalid login')) {
    errorMessage = 'Email configuration error. Please contact support.';
    console.error('   🔧 Fix: Verify Gmail App Password is correct');
  }

  res.status(500).json({
    success: false,
    error: errorMessage,
    // Include error code for debugging (remove in production)
    debugCode: error.code || 'UNKNOWN'
  });
}
*/















const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, 
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

// Create reusable transporter with better error handling

const createTransporter = () => {
  try {
    return nodemailer.createTransport({  // ✅ CORRECT - removed the "er"
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Additional security options
      secure: true,
      requireTLS: true,
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000      // 60 seconds
    });
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error);
    throw error;
  }
};

// Enhanced email validation
const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Enhanced input sanitization
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .substring(0, 2000); // Limit length to prevent abuse
};

// Validate required environment variables
const validateEnvironment = () => {
  const required = ['EMAIL_USER', 'EMAIL_PASS'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
};

// Test email configuration on startup
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email configuration verified successfully');
  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    console.error('Please check your EMAIL_USER and EMAIL_PASS environment variables');
  }
};

// Contact form endpoint with enhanced error handling
app.post('/api/contact', emailLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, phone, company, budget, timeline } = req.body;

    // Enhanced validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, subject, and message are required fields'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Sanitize all inputs
    const sanitizedData = {
      name: sanitizeInput(name),
      email: sanitizeInput(email).toLowerCase(),
      subject: sanitizeInput(subject),
      message: sanitizeInput(message),
      phone: phone ? sanitizeInput(phone) : '',
      company: company ? sanitizeInput(company) : '',
      budget: budget ? sanitizeInput(budget) : '',
      timeline: timeline ? sanitizeInput(timeline) : ''
    };

    // Enhanced length validation
    if (sanitizedData.name.length < 2 || sanitizedData.name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Name must be between 2 and 100 characters'
      });
    }

    if (sanitizedData.message.length < 10 || sanitizedData.message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message must be between 10 and 2000 characters'
      });
    }

    if (sanitizedData.subject.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Subject must be less than 200 characters'
      });
    }

    // Create transporter for this request
    const transporter = createTransporter();

    // Enhanced notification email to you
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.WORK_EMAIL || process.env.EMAIL_USER,
      subject: `🚀 New Project Inquiry: ${sanitizedData.subject}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 20px;">
          <div style="background: white; padding: 40px; border-radius: 15px; box-shadow: 0 20px 60px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 40px;">
              <h1 style="color: #333; margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                🎯 NEW PROJECT INQUIRY
              </h1>
              <div style="width: 80px; height: 4px; background: linear-gradient(45deg, #667eea, #764ba2); margin: 20px auto; border-radius: 2px;"></div>
            </div>

            <!-- Client Information -->
            <div style="background: #f8f9ff; padding: 25px; border-radius: 12px; margin-bottom: 30px; border-left: 5px solid #667eea;">
              <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px; display: flex; align-items: center;">
                <span style="margin-right: 10px;">👤</span> Client Information
              </h3>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                  <strong style="color: #667eea; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Name</strong>
                  <p style="margin: 5px 0 0 0; color: #333; font-size: 16px; font-weight: 600;">${sanitizedData.name}</p>
                </div>
                <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                  <strong style="color: #667eea; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Email</strong>
                  <p style="margin: 5px 0 0 0; color: #333; font-size: 16px; font-weight: 600;">
                    <a href="mailto:${sanitizedData.email}" style="color: #667eea; text-decoration: none;">${sanitizedData.email}</a>
                  </p>
                </div>
              </div>

              ${sanitizedData.phone ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                  <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <strong style="color: #667eea; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Phone</strong>
                    <p style="margin: 5px 0 0 0; color: #333; font-size: 16px; font-weight: 600;">${sanitizedData.phone}</p>
                  </div>
                  ${sanitizedData.company ? `
                    <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                      <strong style="color: #667eea; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Company</strong>
                      <p style="margin: 5px 0 0 0; color: #333; font-size: 16px; font-weight: 600;">${sanitizedData.company}</p>
                    </div>
                  ` : '<div></div>'}
                </div>
              ` : ''}

              <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <strong style="color: #667eea; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Subject</strong>
                <p style="margin: 5px 0 0 0; color: #333; font-size: 16px; font-weight: 600;">${sanitizedData.subject}</p>
              </div>
            </div>

            <!-- Project Details -->
            ${(sanitizedData.budget || sanitizedData.timeline) ? `
              <div style="background: #fff8f0; padding: 25px; border-radius: 12px; margin-bottom: 30px; border-left: 5px solid #ff9500;">
                <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px; display: flex; align-items: center;">
                  <span style="margin-right: 10px;">💼</span> Project Details
                </h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  ${sanitizedData.budget ? `
                    <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                      <strong style="color: #ff9500; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Budget</strong>
                      <p style="margin: 5px 0 0 0; color: #333; font-size: 16px; font-weight: 600;">${sanitizedData.budget}</p>
                    </div>
                  ` : ''}
                  ${sanitizedData.timeline ? `
                    <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                      <strong style="color: #ff9500; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Timeline</strong>
                      <p style="margin: 5px 0 0 0; color: #333; font-size: 16px; font-weight: 600;">${sanitizedData.timeline}</p>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Message -->
            <div style="background: #f0f8ff; padding: 25px; border-radius: 12px; margin-bottom: 30px; border-left: 5px solid #4CAF50;">
              <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px; display: flex; align-items: center;">
                <span style="margin-right: 10px;">💬</span> Message
              </h3>
              <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <p style="color: #555; line-height: 1.8; margin: 0; font-size: 16px; white-space: pre-wrap;">${sanitizedData.message}</p>
              </div>
            </div>

            <!-- Quick Actions -->
            <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 2px solid #f0f0f0;">
              <p style="color: #667eea; font-size: 16px; font-weight: 600; margin-bottom: 15px;">
                📧 Reply to: ${sanitizedData.email}
              </p>
              ${sanitizedData.phone ? `
                <p style="color: #4CAF50; font-size: 16px; font-weight: 600; margin-bottom: 15px;">
                  📞 Call: ${sanitizedData.phone}
                </p>
              ` : ''}
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e1e5e9;">
              <p style="color: #888; font-size: 14px; margin: 0;">
                🚀 Portfolio Contact Form • ${new Date().toLocaleString('en-IN', { 
                  timeZone: 'Asia/Kolkata',
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })} IST
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
NEW PROJECT INQUIRY - ${sanitizedData.subject}

CLIENT INFORMATION:
Name: ${sanitizedData.name}
Email: ${sanitizedData.email}
${sanitizedData.phone ? `Phone: ${sanitizedData.phone}` : ''}
${sanitizedData.company ? `Company: ${sanitizedData.company}` : ''}

PROJECT DETAILS:
${sanitizedData.budget ? `Budget: ${sanitizedData.budget}` : ''}
${sanitizedData.timeline ? `Timeline: ${sanitizedData.timeline}` : ''}

MESSAGE:
${sanitizedData.message}

---
Received: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
      `
    };

    // Enhanced auto-reply
    const autoReplyOptions = {
      from: process.env.EMAIL_USER,
      to: sanitizedData.email,
      subject: `Thanks for reaching out! Re: ${sanitizedData.subject}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 20px;">
          <div style="background: white; padding: 40px; border-radius: 15px; box-shadow: 0 20px 60px rgba(0,0,0,0.1);">
            
            <div style="text-align: center; margin-bottom: 40px;">
              <h1 style="color: #333; margin: 0; font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                🚀 Thanks for reaching out!
              </h1>
              <div style="width: 80px; height: 4px; background: linear-gradient(45deg, #667eea, #764ba2); margin: 20px auto; border-radius: 2px;"></div>
            </div>

            <div style="color: #555; line-height: 1.8; font-size: 16px;">
              <p style="font-size: 18px;">Hi <strong style="color: #333; font-size: 20px;">${sanitizedData.name}</strong>,</p>
              
              <p>Thanks for your interest in working together! I've received your message about "<strong style="color: #667eea;">${sanitizedData.subject}</strong>" and I'm excited to learn more about your project.</p>
              
              <div style="background: #f8f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 5px solid #667eea;">
                <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">🎯 What happens next?</h3>
                <ul style="padding-left: 0; list-style: none;">
                  <li style="margin: 12px 0; padding-left: 25px; position: relative;">
                    <span style="position: absolute; left: 0; color: #667eea; font-weight: bold;">✓</span>
                    I'll review your project details carefully
                  </li>
                  <li style="margin: 12px 0; padding-left: 25px; position: relative;">
                    <span style="position: absolute; left: 0; color: #667eea; font-weight: bold;">✓</span>
                    You'll hear back from me within 24 hours
                  </li>
                  <li style="margin: 12px 0; padding-left: 25px; position: relative;">
                    <span style="position: absolute; left: 0; color: #667eea; font-weight: bold;">✓</span>
                    We can schedule a call to discuss your vision in detail
                  </li>
                </ul>
              </div>

              <div style="background: #fff8f0; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #ff9500;">
                <p style="margin: 0; color: #555; font-style: italic;"><strong style="color: #333;">Your message:</strong></p>
                <p style="margin: 15px 0 0 0; color: #666; background: white; padding: 15px; border-radius: 8px; border-left: 3px solid #ff9500;">"${sanitizedData.message}"</p>
              </div>

              <p>In the meantime, feel free to:</p>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
                <a href="https://github.com/AditS-H" style="display: block; background: #24292e; color: white; padding: 15px; text-decoration: none; border-radius: 10px; text-align: center; font-weight: 600;">
                  🔗 Check my GitHub
                </a>
                <a href="https://www.linkedin.com/in/adit-sharma-387551312/" style="display: block; background: #0077b5; color: white; padding: 15px; text-decoration: none; border-radius: 10px; text-align: center; font-weight: 600;">
                  💼 Connect on LinkedIn
                </a>
              </div>
              
              <p style="font-size: 18px; font-weight: 600; color: #333;">Looking forward to building something amazing together! 🔥</p>
              
              <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #f0f0f0;">
                <p style="margin: 0; font-size: 18px; font-weight: 600;">
                  Best regards,<br>
                  <span style="color: #667eea; font-size: 24px; font-weight: 700;">Adit Sharma</span><br>
                </p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e1e5e9; background: #f8f9ff; margin-left: -40px; margin-right: -40px; margin-bottom: -40px; padding-left: 40px; padding-right: 40px; padding-bottom: 30px; border-radius: 0 0 15px 15px;">
              <p style="color: #667eea; font-size: 14px; margin: 0; font-weight: 600;">
                📧 workadit2@gmail.com • 📱 +91 86303 58219 • 📍 Delhi-NCR, India
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
Hi ${sanitizedData.name},

Thanks for your interest in working together! I've received your message about "${sanitizedData.subject}" and I'm excited to learn more about your project.

What happens next?
✓ I'll review your project details carefully
✓ You'll hear back from me within 24 hours  
✓ We can schedule a call to discuss your vision

Your message: "${sanitizedData.message}"

In the meantime, feel free to check out my work:
- GitHub: https://github.com/AditS-H
- LinkedIn: https://www.linkedin.com/in/adit-sharma-387551312/

Looking forward to building something amazing together!

Best regards,
Adit Sharma
Full Stack Developer

📧 workadit2@gmail.com
📱 +91 86303 58219
📍 Delhi-NCR, India
      `
    };

    // Send both emails with proper error handling
    const emailPromises = [
      transporter.sendMail(mailOptions),
      transporter.sendMail(autoReplyOptions)
    ];

    await Promise.all(emailPromises);

    // Log successful submission
    console.log(`📧 New contact form submission processed successfully:`);
    console.log(`   👤 Name: ${sanitizedData.name}`);
    console.log(`   📧 Email: ${sanitizedData.email}`);
    console.log(`   📝 Subject: ${sanitizedData.subject}`);
    console.log(`   ⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);

    res.status(200).json({
      success: true,
      message: 'Message sent successfully! You should receive a confirmation email shortly.'
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    
    // Provide specific error messages based on error type
    let errorMessage = 'Failed to send message. Please try again later.';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please contact support.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Connection failed. Please check your internet connection and try again.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Request timed out. Please try again.';
    }

    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Enhanced health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Contact form API is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

// API info endpoint
app.get('/api/info', (req, res) => {
  res.status(200).json({
    success: true,
    name: 'Portfolio Contact Form API',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      contact: '/api/contact (POST)',
      info: '/api/info'
    },
    rateLimit: {
      windowMs: '15 minutes',
      max: 10
    }
  });
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    availableEndpoints: ['/api/health', '/api/contact', '/api/info']
  });
});

// Handle all other 404s
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(isDevelopment && { details: error.message })
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server with enhanced logging
const startServer = async () => {
  try {
    // Validate environment variables
    validateEnvironment();
    
    // Test email configuration
    await testEmailConfig();
    
    // Start the server
    app.listen(PORT, () => {
      console.log('\n🚀 ================================');
      console.log('🚀 Contact Form Server Started!');
      console.log('🚀 ================================');
      console.log(`📡 Server running on port: ${PORT}`);
      console.log(`📧 Email service: ${process.env.EMAIL_USER}`);
      console.log(`📬 Work email: ${process.env.WORK_EMAIL || process.env.EMAIL_USER}`);
      console.log(`🌍 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🛡️  Rate limit: 10 requests per 15 minutes`);
      console.log(`⏰ Started at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
      console.log('🚀 Ready to receive contact forms!\n');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();