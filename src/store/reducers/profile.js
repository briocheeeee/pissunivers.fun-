const initialState = {
  fishes: [],
  badges: [],
  lastFetch: 0,
};

export default function profile(state = initialState, action) {
  switch (action.type) {
    case 'REC_PROFILE':
      return {
        ...action.profile,
        lastFetch: Date.now(),
      };

    case 'FISH_CATCHED': {
      if (!action.success) {
        return state;
      }
      const { fishType: type, size } = action;
      return {
        ...state,
        fishes: [
          ...state.fishes,
          { type, size, ts: Date.now() },
        ],
      };
    }

    case 's/LOGIN':
    case 's/LOGOUT':
      // reset profile if user changes
      return { ...initialState };

    default:
      return state;
  }
}
