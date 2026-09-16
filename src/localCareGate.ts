// Local development only: Vite removes this branch from public production builds.
export const localCareLab=import.meta.env.DEV&&import.meta.env.VITE_LOCAL_CARE_LAB==='true'&&['localhost','127.0.0.1'].includes(location.hostname);
