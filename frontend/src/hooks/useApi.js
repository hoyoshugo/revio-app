import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function useApi() {
  const token = localStorage.getItem('mystica_token');

  const client = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  async function get(url, params = {}) {
    const { data } = await client.get(url, { params });
    return data;
  }

  async function post(url, body = {}) {
    const { data } = await client.post(url, body);
    return data;
  }

  async function patch(url, body = {}) {
    const { data } = await client.patch(url, body);
    return data;
  }

  return { get, post, patch };
}

export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, deps);

  return { data, loading, error, reload: load };
}
