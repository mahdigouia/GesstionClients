# Configuration Firebase Authentication

## Variables d'environnement requises

Créez un fichier `.env.local` à la racine du projet avec les variables suivantes :

```env
NEXT_PUBLIC_FIREBASE_API_KEY=votre_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=votre_projet.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=votre_projet
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=votre_projet.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=votre_app_id
```

## Où trouver ces valeurs ?

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com)
2. Sélectionnez votre projet
3. Cliquez sur l'icône ⚙️ (Paramètres du projet) en haut à gauche
4. Dans "Vos applications", sélectionnez l'app Web
5. Copiez la configuration `firebaseConfig`

## Activer Authentication

1. Dans le menu latéral Firebase, cliquez sur **"Authentication"**
2. Cliquez sur **"Commencer"**
3. Activez la méthode **"Email/Mot de passe"**
4. Cliquez sur **"Enregistrer"**

## Test

Une fois configuré, vous pouvez :
- Créer un compte sur `/register`
- Vous connecter sur `/login`
- Voir vos initiales dans la sidebar
- Gérer votre profil dans `/settings`
