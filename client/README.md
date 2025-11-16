
# Alphaversion Webapp

## Project Structure

- **client/**: React frontend, HTML pages, assets, and styles
- **server/**: Node.js/Express backend, TypeScript controllers, models, routes, middleware
- **css/**: (Removed/cleaned) No longer used for styling
- **javascript/**: (Review/remove unused) Only keep scripts referenced by the webapp

## Usage

### Frontend
- Run `npm start` in `client/` to launch the React app
- All user/session logic uses the updated backend structure
- API calls in `src/services/api.ts` match backend responses

### Backend
- All controllers, middleware, and routes use Express built-in types (`req: any` for user access)
- No custom request/user types (`IUser`, `AuthRequest`)
- Only `.ts` files are kept; all duplicate `.js` files removed

## Cleanup Actions
- Removed unused CSS files from `css/`
- Removed unused/duplicate JS files from `javascript/`
- Removed obsolete type augmentation and custom request/user types
- Updated all context, service, and type files for compatibility
- Removed `README.old.md`

## How to Contribute
- Keep all types in sync with backend models
- Only add assets/styles/scripts that are actively used
- Update documentation as structure or usage changes

## Scripts
- `npm start` — Start frontend
- `npm run build` — Build frontend for production
- `npm test` — Run frontend tests

## Deployment
- Build the frontend and backend separately
- Deploy the `build/` folder from `client/` and the compiled backend from `server/`

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
