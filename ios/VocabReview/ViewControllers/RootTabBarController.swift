import UIKit

final class RootTabBarController: UITabBarController {
    override func viewDidLoad() {
        super.viewDidLoad()

        configureAppearance()

        viewControllers = [
            makeNavigationController(
                root: HomeViewController(),
                title: "复习",
                icon: "rectangle.stack.fill",
                inactiveIcon: "rectangle.stack"
            ),
            makeNavigationController(
                root: VocabularyViewController(),
                title: "词库",
                icon: "book.fill",
                inactiveIcon: "book"
            ),
            makeNavigationController(
                root: SettingsViewController(),
                title: "设置",
                icon: "gearshape.fill",
                inactiveIcon: "gearshape"
            )
        ]
    }

    private func configureAppearance() {
        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.configureWithDefaultBackground()
        tabBarAppearance.backgroundColor = Theme.Colors.cardBackground
        tabBar.standardAppearance = tabBarAppearance
        tabBar.scrollEdgeAppearance = tabBarAppearance
        tabBar.tintColor = Theme.Colors.accent

        let navBarAppearance = UINavigationBarAppearance()
        navBarAppearance.configureWithDefaultBackground()
        navBarAppearance.backgroundColor = Theme.Colors.pageBackground
        navBarAppearance.shadowColor = .clear
        navBarAppearance.titleTextAttributes = [.font: Theme.Font.headline]
        navBarAppearance.largeTitleTextAttributes = [.font: Theme.Font.largeTitle]

        UINavigationBar.appearance().standardAppearance = navBarAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navBarAppearance
        UINavigationBar.appearance().tintColor = Theme.Colors.accent
    }

    private func makeNavigationController(root: UIViewController, title: String, icon: String, inactiveIcon: String) -> UIViewController {
        root.title = title
        let navigationController = UINavigationController(rootViewController: root)
        navigationController.tabBarItem = UITabBarItem(
            title: title,
            image: UIImage(systemName: inactiveIcon),
            selectedImage: UIImage(systemName: icon)
        )
        return navigationController
    }
}
