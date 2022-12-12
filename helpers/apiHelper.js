import axios from 'axios';

class API_Helper {
  constructor() {}

  async apiGet(config) {
    try {
      const { url, encodedToken, params } = config;

      const result = await axios({
        method: 'GET',
        url,
        headers: {
          Authorization: 'Basic ' + encodedToken,
        },
        params,
      });

      return { data: result.data };
    } catch (error) {
      throw new Error(error.response.data.error);
    }
  }

  async apiPatch(config) {
    try {
      const { url, encodedToken, data } = config;

      const result = await axios({
        method: 'PATCH',
        url,
        headers: {
          Authorization: 'Basic ' + encodedToken,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        data,
      });

      return { data: result.data };
    } catch (error) {
      throw new Error(error.response.data.error);
    }
  }

  async apiPost(config) {
    try {
      const { url, encodedToken, data } = config;

      const result = await axios({
        method: 'POST',
        url,
        headers: {
          Authorization: 'Basic ' + encodedToken,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        data,
      });

      return { data: result.data };
    } catch (error) {
      throw new Error(error.response.data.error);
    }
  }
}

export default API_Helper;
