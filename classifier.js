const DEFAULT_CLASSIFICATIONS = {
  productive: [
    'github.com',
    'gitlab.com',
    'stackoverflow.com',
    'developer.mozilla.org',
    'docs.google.com',
    'notion.so',
    'figma.com',
    'codepen.io',
    'leetcode.com',
    'hackerrank.com',
    'coursera.org',
    'udemy.com',
    'khanacademy.org',
    'medium.com',
    'dev.to',
    'npmjs.com',
    'pypi.org',
    'wikipedia.org',
    'arxiv.org',
    'scholar.google.com',
    'linkedin.com',
    'slack.com',
    'teams.microsoft.com',
    'zoom.us',
    'meet.google.com',
    'jira.atlassian.com',
    'trello.com',
    'asana.com',
    'linear.app',
    'vercel.com',
    'netlify.com',
    'aws.amazon.com',
    'console.cloud.google.com',
    'portal.azure.com'
  ],
  unproductive: [
    'facebook.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    'tiktok.com',
    'reddit.com',
    'youtube.com',
    'netflix.com',
    'twitch.tv',
    'pinterest.com',
    'snapchat.com',
    'discord.com',
    '9gag.com',
    'buzzfeed.com',
    'tmz.com',
    'espn.com',
    'roblox.com',
    'steampowered.com',
    'amazon.com'
  ]
};

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname;
  } catch {
    return null;
  }
}

function matchesDomain(hostname, pattern) {
  return hostname === pattern || hostname.endsWith('.' + pattern);
}

function classifyDomain(domain, customClassifications = []) {
  for (const entry of customClassifications) {
    if (matchesDomain(domain, entry.domain)) {
      return entry.category;
    }
  }

  for (const pattern of DEFAULT_CLASSIFICATIONS.productive) {
    if (matchesDomain(domain, pattern)) return 'productive';
  }

  for (const pattern of DEFAULT_CLASSIFICATIONS.unproductive) {
    if (matchesDomain(domain, pattern)) return 'unproductive';
  }

  return 'neutral';
}

module.exports = {
  DEFAULT_CLASSIFICATIONS,
  extractDomain,
  classifyDomain
};
