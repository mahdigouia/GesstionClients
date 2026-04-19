export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Bienvenue sur GesstionClients
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Votre application de gestion de clients est maintenant en ligne!
        </p>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Fonctionnalités
          </h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Gestion des clients</li>
            <li>Suivi des interactions</li>
            <li>Tableau de bord analytique</li>
            <li>Interface moderne et responsive</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
