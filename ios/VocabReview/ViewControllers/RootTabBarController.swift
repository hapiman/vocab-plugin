import UIKit

final class RootTabBarController: UITabBarController {
    override func viewDidLoad() {
        super.viewDidLoad()

        viewControllers = [
            makeNavigationController(
                root: HomeViewController(),
                title: "复习",
                image: UIImage(systemName: "rectangle.stack")
            ),
            makeNavigationController(
                root: VocabularyViewController(),
                title: "词库",
                image: UIImage(systemName: "book")
            ),
            makeNavigationController(
                root: SettingsViewController(),
                title: "设置",
                image: UIImage(systemName: "gearshape")
            )
        ]
    }

    private func makeNavigationController(root: UIViewController, title: String, image: UIImage?) -> UIViewController {
        root.title = title
        let navigationController = UINavigationController(rootViewController: root)
        navigationController.tabBarItem = UITabBarItem(title: title, image: image, selectedImage: nil)
        return navigationController
    }
}
