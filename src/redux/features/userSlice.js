import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
    name: "user",
    initialState: {
        user: null,
        authChecked: false,
    },

    reducers:{
        setUser: (state, action) =>{
            state.user = action.payload;
            state.authChecked = true;
        },
        clearUser: (state) => {
            state.user = null;
            state.authChecked = true;
        },
        setAuthChecked: (state, action) => {
            state.authChecked = action.payload;
        },
    }
})

export const { setUser, clearUser, setAuthChecked } = userSlice.actions
export default userSlice.reducer
