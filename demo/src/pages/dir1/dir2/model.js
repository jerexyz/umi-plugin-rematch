export const namespace = 'dir1.dir2'

export default {
  state: {name:'dir1.dir2'}, // initial state
  reducers: {
    // handle state changes with pure functions
    increment(state, payload) {
      return state + payload;
    },
  },
  effects: dispatch => ({
    // handle state changes with impure functions.
    // use async/await for async actions
    async updateUser(payload, rootState) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      dispatch.count.increment(payload);
    },
  }),
};
