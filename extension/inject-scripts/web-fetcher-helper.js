// Enhanced web content fetcher helper - Chrome Pilot
// This script provides comprehensive content extraction capabilities

if (window.__WEB_FETCHER_HELPER_INITIALIZED__) {
  // Already initialized, skip
} else {
  window.__WEB_FETCHER_HELPER_INITIALIZED__ = true;

  /**
   * Extract HTML content from page or specific element
   * @param {string} selector - Optional CSS selector to limit extraction
   * @returns {Object} - Extracted HTML content with metadata
   */
  function getHTMLContent(selector = null) {
    try {
      let targetElement = document;
      let htmlContent = '';

      if (selector) {
        targetElement = document.querySelector(selector);
        if (!targetElement) {
          return {
            success: false,
            error: `Element with selector "${selector}" not found`,
          };
        }
        htmlContent = targetElement.outerHTML;
      } else {
        htmlContent = document.documentElement.outerHTML;
      }

      // Clean up the HTML (remove script tags, etc.)
      const cleanHTML = cleanHTMLContent(htmlContent);

      return {
        success: true,
        htmlContent: cleanHTML,
        selector: selector || 'document',
        contentLength: cleanHTML.length,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Error extracting HTML content: ${error.message}`,
      };
    }
  }

  /**
   * Extract text content with structured information
   * @param {string} selector - Optional CSS selector to limit extraction
   * @returns {Object} - Extracted text content with metadata
   */
  function getTextContent(selector = null) {
    try {
      let targetElement = document;
      let textContent = '';
      let structure = {};

      if (selector) {
        targetElement = document.querySelector(selector);
        if (!targetElement) {
          return {
            success: false,
            error: `Element with selector "${selector}" not found`,
          };
        }
        textContent = targetElement.textContent || targetElement.innerText || '';
      } else {
        targetElement = document.body || document;
        textContent = targetElement.textContent || targetElement.innerText || '';
        
        // Extract page structure
        structure = extractPageStructure();
      }

      // Clean up text content
      const cleanText = cleanTextContent(textContent);

      // Extract metadata
      const metadata = extractPageMetadata();

      // Try to extract article content using readability heuristics
      const article = extractArticleContent();

      return {
        success: true,
        textContent: cleanText,
        selector: selector || 'body',
        contentLength: cleanText.length,
        wordCount: cleanText.split(/\s+/).filter(word => word.length > 0).length,
        structure: structure,
        metadata: metadata,
        article: article,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Error extracting text content: ${error.message}`,
      };
    }
  }

  /**
   * Clean HTML content by removing unwanted elements
   * @param {string} html - Raw HTML content
   * @returns {string} - Cleaned HTML content
   */
  function cleanHTMLContent(html) {
    // Create a temporary element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove script tags, style tags, and comments
    const unwantedSelectors = [
      'script',
      'style',
      'noscript',
      '[style*="display: none"]',
      '[style*="visibility: hidden"]',
      '.ad',
      '.advertisement',
      '.popup',
      '.modal',
      '.overlay'
    ];

    unwantedSelectors.forEach(selector => {
      const elements = tempDiv.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    return tempDiv.innerHTML;
  }

  /**
   * Clean text content by normalizing whitespace and removing unwanted characters
   * @param {string} text - Raw text content
   * @returns {string} - Cleaned text content
   */
  function cleanTextContent(text) {
    return text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim()
      // Remove excessive line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Remove non-printable characters except common ones
      .replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, '');
  }

  /**
   * Extract structured information about the page
   * @returns {Object} - Page structure information
   */
  function extractPageStructure() {
    const structure = {
      headings: [],
      links: [],
      images: [],
      forms: [],
      lists: [],
    };

    // Extract headings
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      structure.headings.push({
        level: parseInt(heading.tagName.substring(1)),
        text: heading.textContent?.trim() || '',
        id: heading.id || '',
      });
    });

    // Extract links
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('javascript:')) {
        structure.links.push({
          text: link.textContent?.trim() || '',
          href: href,
          isInternal: href.startsWith('/') || href.includes(window.location.hostname),
        });
      }
    });

    // Extract images
    const images = document.querySelectorAll('img[src]');
    images.forEach(img => {
      structure.images.push({
        src: img.src,
        alt: img.alt || '',
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
      });
    });

    // Extract forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const inputs = form.querySelectorAll('input, select, textarea');
      structure.forms.push({
        action: form.action || '',
        method: form.method || 'GET',
        inputCount: inputs.length,
        inputs: Array.from(inputs).map(input => ({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name || '',
          placeholder: input.placeholder || '',
        })),
      });
    });

    // Extract lists
    const lists = document.querySelectorAll('ul, ol');
    lists.forEach(list => {
      const items = list.querySelectorAll('li');
      structure.lists.push({
        type: list.tagName.toLowerCase(),
        itemCount: items.length,
        items: Array.from(items).slice(0, 5).map(item => item.textContent?.trim() || ''), // First 5 items only
      });
    });

    return structure;
  }

  /**
   * Extract page metadata from meta tags and other sources
   * @returns {Object} - Page metadata
   */
  function extractPageMetadata() {
    const metadata = {
      title: document.title || '',
      description: '',
      keywords: '',
      author: '',
      canonical: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      ogUrl: '',
      twitterTitle: '',
      twitterDescription: '',
      twitterImage: '',
      lang: document.documentElement.lang || '',
      charset: document.charset || '',
    };

    // Extract meta tags
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content') || '';

      switch (name?.toLowerCase()) {
        case 'description':
          metadata.description = content;
          break;
        case 'keywords':
          metadata.keywords = content;
          break;
        case 'author':
          metadata.author = content;
          break;
        case 'og:title':
          metadata.ogTitle = content;
          break;
        case 'og:description':
          metadata.ogDescription = content;
          break;
        case 'og:image':
          metadata.ogImage = content;
          break;
        case 'og:url':
          metadata.ogUrl = content;
          break;
        case 'twitter:title':
          metadata.twitterTitle = content;
          break;
        case 'twitter:description':
          metadata.twitterDescription = content;
          break;
        case 'twitter:image':
          metadata.twitterImage = content;
          break;
      }
    });

    // Extract canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      metadata.canonical = canonical.href || '';
    }

    return metadata;
  }

  /**
   * Extract article content using readability heuristics
   * @returns {Object|null} - Article content if detected
   */
  function extractArticleContent() {
    // Look for common article containers
    const articleSelectors = [
      'article',
      '[role="article"]',
      '.article',
      '.post',
      '.content',
      '.entry',
      '.story',
      'main article',
      'main .content',
    ];

    let articleElement = null;
    
    for (const selector of articleSelectors) {
      articleElement = document.querySelector(selector);
      if (articleElement) break;
    }

    // If no explicit article container, try to find the main content area
    if (!articleElement) {
      const contentCandidates = document.querySelectorAll('div');
      let bestCandidate = null;
      let maxScore = 0;

      contentCandidates.forEach(candidate => {
        const text = candidate.textContent || '';
        const score = calculateContentScore(candidate, text);
        if (score > maxScore) {
          maxScore = score;
          bestCandidate = candidate;
        }
      });

      if (bestCandidate && maxScore > 50) {
        articleElement = bestCandidate;
      }
    }

    if (!articleElement) {
      return null;
    }

    const articleText = articleElement.textContent?.trim() || '';
    if (articleText.length < 100) {
      return null; // Too short to be meaningful article content
    }

    // Extract article metadata
    const title = extractArticleTitle(articleElement);
    const byline = extractArticleByline(articleElement);
    const publishDate = extractPublishDate(articleElement);

    return {
      title: title,
      byline: byline,
      publishDate: publishDate,
      content: articleText,
      contentLength: articleText.length,
      wordCount: articleText.split(/\s+/).filter(word => word.length > 0).length,
      siteName: extractSiteName(),
      excerpt: generateExcerpt(articleText),
      lang: document.documentElement.lang || 'en',
    };
  }

  /**
   * Calculate content score for readability heuristics
   * @param {Element} element - Element to score
   * @param {string} text - Text content of element
   * @returns {number} - Content score
   */
  function calculateContentScore(element, text) {
    let score = 0;

    // Base score from text length
    score += Math.min(text.length / 100, 25);

    // Positive indicators
    const positiveClasses = ['content', 'article', 'post', 'story', 'entry', 'main'];
    const className = element.className.toLowerCase();
    if (positiveClasses.some(cls => className.includes(cls))) {
      score += 25;
    }

    // Negative indicators
    const negativeClasses = ['sidebar', 'nav', 'menu', 'footer', 'header', 'ad', 'comment'];
    if (negativeClasses.some(cls => className.includes(cls))) {
      score -= 25;
    }

    // Paragraph count bonus
    const paragraphs = element.querySelectorAll('p');
    score += Math.min(paragraphs.length * 3, 25);

    return Math.max(0, score);
  }

  /**
   * Extract article title
   * @param {Element} articleElement - Article container element
   * @returns {string} - Article title
   */
  function extractArticleTitle(articleElement) {
    const titleSelectors = ['h1', 'h2', '.title', '.headline', '[itemprop="headline"]'];
    
    for (const selector of titleSelectors) {
      const titleElement = articleElement.querySelector(selector);
      if (titleElement) {
        return titleElement.textContent?.trim() || '';
      }
    }

    // Fallback to page title
    return document.title || '';
  }

  /**
   * Extract article byline (author information)
   * @param {Element} articleElement - Article container element
   * @returns {string} - Article byline
   */
  function extractArticleByline(articleElement) {
    const bylineSelectors = [
      '[rel="author"]',
      '.author',
      '.byline',
      '[itemprop="author"]',
      '.writer',
      '.reporter'
    ];

    for (const selector of bylineSelectors) {
      const bylineElement = articleElement.querySelector(selector);
      if (bylineElement) {
        return bylineElement.textContent?.trim() || '';
      }
    }

    return '';
  }

  /**
   * Extract publish date
   * @param {Element} articleElement - Article container element
   * @returns {string} - Publish date
   */
  function extractPublishDate(articleElement) {
    const dateSelectors = [
      'time[datetime]',
      '[itemprop="datePublished"]',
      '.date',
      '.published',
      '.timestamp'
    ];

    for (const selector of dateSelectors) {
      const dateElement = articleElement.querySelector(selector);
      if (dateElement) {
        return dateElement.getAttribute('datetime') || 
               dateElement.textContent?.trim() || '';
      }
    }

    return '';
  }

  /**
   * Extract site name
   * @returns {string} - Site name
   */
  function extractSiteName() {
    const siteName = document.querySelector('meta[property="og:site_name"]');
    if (siteName) {
      return siteName.getAttribute('content') || '';
    }

    // Fallback to hostname
    return window.location.hostname;
  }

  /**
   * Generate excerpt from content
   * @param {string} text - Full text content
   * @param {number} maxLength - Maximum excerpt length
   * @returns {string} - Generated excerpt
   */
  function generateExcerpt(text, maxLength = 200) {
    if (text.length <= maxLength) {
      return text;
    }

    // Find the last complete sentence within the limit
    const truncated = text.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (lastSentenceEnd > maxLength * 0.6) {
      return truncated.substring(0, lastSentenceEnd + 1).trim();
    }

    // Fallback to word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace).trim() + '...';
    }

    return truncated.trim() + '...';
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    try {
      switch (request.action) {
        case 'getHTMLContent':
          const htmlResult = getHTMLContent(request.selector);
          sendResponse(htmlResult);
          return false;

        case 'getTextContent':
          const textResult = getTextContent(request.selector);
          sendResponse(textResult);
          return false;

        case 'chrome_web_fetcher_ping':
          sendResponse({ status: 'pong' });
          return false;

        default:
          sendResponse({ 
            success: false, 
            error: `Unknown action: ${request.action}` 
          });
          return false;
      }
    } catch (error) {
      console.error('Web fetcher helper error:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
      return false;
    }
  });

  console.log('Web fetcher helper script loaded');
}