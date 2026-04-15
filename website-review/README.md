# WebsiteReview

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## In-Page Review Widget (No iframe)

This project includes an injectable client script at `public/review-widget.js`.

### Load via script tag

```html
<script src="https://your-host/review-widget.js" data-project-id="YOUR_PROJECT_ID"></script>
```

If `data-project-id` is present, the widget auto-initializes.

### Manual initialization

```html
<script src="https://your-host/review-widget.js"></script>
<script>
  window.WebsiteReviewWidget.init({
    projectId: 'YOUR_PROJECT_ID',
    userName: 'Client Name',
    firebaseConfig: {
      apiKey: '...',
      authDomain: '...',
      projectId: '...',
      storageBucket: '...',
      messagingSenderId: '...',
      appId: '...',
    },
  });
</script>
```

### Behavior

- Runs directly in the website DOM.
- Includes `Comment` and `View` modes.
- In comment mode, click anywhere to place a comment.
- Stores selector + offsets + scroll position + fallback page coordinates.
- Renders pins in-page and syncs comments in realtime from Firestore by `projectId`.
