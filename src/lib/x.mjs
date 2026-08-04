import { required } from './env.mjs';

const API = 'https://api.x.com/2/tweets/search/recent';

function responseError(status, text) {
  return new Error(`X API ${status}: ${text.slice(0, 500)}`);
}

export async function searchRecentPosts(handles, { since, maxResults = 10 } = {}) {
  const token = required('X_BEARER_TOKEN');
  const results = await Promise.all(handles.map(async (handle) => {
    const url = new URL(API);
    url.searchParams.set('query', `from:${handle} -is:reply -is:retweet`);
    url.searchParams.set('max_results', String(Math.max(10, Math.min(maxResults, 100))));
    url.searchParams.set('tweet.fields', 'author_id,created_at,conversation_id,public_metrics');
    url.searchParams.set('expansions', 'author_id');
    url.searchParams.set('user.fields', 'name,username');
    if (since) url.searchParams.set('start_time', since.toISOString());
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw responseError(response.status, await response.text());
    const payload = await response.json();
    const author = new Map((payload.includes?.users || []).map((user) => [user.id, user]));
    return (payload.data || []).map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      metrics: tweet.public_metrics || {},
      author: author.get(tweet.author_id) || { username: handle },
      url: `https://x.com/${author.get(tweet.author_id)?.username || handle}/status/${tweet.id}`,
    }));
  }));
  return results.flat().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}
