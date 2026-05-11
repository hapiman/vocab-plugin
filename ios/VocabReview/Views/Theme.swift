import UIKit

// MARK: - Design Tokens

enum Theme {

    // MARK: Colors

    enum Colors {
        static let primaryGradientStart = UIColor(red: 0.25, green: 0.47, blue: 0.85, alpha: 1.0) // #4078D9
        static let primaryGradientEnd = UIColor(red: 0.45, green: 0.32, blue: 0.78, alpha: 1.0)   // #7352C7
        static let accent = UIColor(red: 0.25, green: 0.47, blue: 0.85, alpha: 1.0)

        static let cardBackground = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 0.12, alpha: 1)
                : .white
        }

        static let pageBackground = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 0.05, alpha: 1)
                : UIColor(red: 0.96, green: 0.96, blue: 0.98, alpha: 1)
        }

        static let statDue = UIColor(red: 0.95, green: 0.45, blue: 0.35, alpha: 1.0)      // Warm orange-red
        static let statLearning = UIColor(red: 0.25, green: 0.47, blue: 0.85, alpha: 1.0)  // Blue
        static let statMastered = UIColor(red: 0.30, green: 0.75, blue: 0.55, alpha: 1.0)  // Green

        static let subtleText = UIColor.secondaryLabel
        static let divider = UIColor.separator.withAlphaComponent(0.15)
    }

    // MARK: Spacing

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
    }

    // MARK: Corner Radius

    enum Radius {
        static let small: CGFloat = 10
        static let medium: CGFloat = 16
        static let large: CGFloat = 20
        static let capsule: CGFloat = 24
    }

    // MARK: Shadows

    static func applyCardShadow(to layer: CALayer) {
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.08
        layer.shadowOffset = CGSize(width: 0, height: 4)
        layer.shadowRadius = 12
        layer.masksToBounds = false
    }

    static func applyLightShadow(to layer: CALayer) {
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.05
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowRadius = 8
        layer.masksToBounds = false
    }

    // MARK: Typography

    enum Font {
        static let largeTitle = UIFont.systemFont(ofSize: 32, weight: .bold)
        static let title = UIFont.systemFont(ofSize: 22, weight: .bold)
        static let headline = UIFont.systemFont(ofSize: 18, weight: .semibold)
        static let body = UIFont.systemFont(ofSize: 16, weight: .regular)
        static let callout = UIFont.systemFont(ofSize: 15, weight: .medium)
        static let caption = UIFont.systemFont(ofSize: 13, weight: .medium)
        static let small = UIFont.systemFont(ofSize: 12, weight: .regular)

        static let statValue = UIFont.rounded(ofSize: 28, weight: .bold)
        static let statLabel = UIFont.systemFont(ofSize: 12, weight: .semibold)
        static let button = UIFont.systemFont(ofSize: 16, weight: .semibold)
        static let wordDisplay = UIFont.systemFont(ofSize: 34, weight: .bold)
    }

    // MARK: Button Styles

    static func applyPrimaryStyle(to button: UIButton) {
        button.titleLabel?.font = Font.button
        button.setTitleColor(.white, for: .normal)
        button.tintColor = .white
        button.backgroundColor = Colors.primaryGradientStart
        button.layer.cornerRadius = Radius.medium
        button.heightAnchor.constraint(equalToConstant: 52).isActive = true
    }

    static func applySecondaryStyle(to button: UIButton) {
        button.titleLabel?.font = Font.button
        button.backgroundColor = Colors.cardBackground
        button.setTitleColor(Colors.accent, for: .normal)
        button.tintColor = Colors.accent
        button.layer.cornerRadius = Radius.medium
        button.heightAnchor.constraint(equalToConstant: 48).isActive = true
        applyLightShadow(to: button.layer)
    }

    // MARK: Animations

    static func animatePress(_ view: UIView, completion: (() -> Void)? = nil) {
        UIView.animate(withDuration: 0.1, delay: 0, options: .curveEaseIn) {
            view.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
        } completion: { _ in
            UIView.animate(withDuration: 0.1, delay: 0, options: .curveEaseOut) {
                view.transform = .identity
            } completion: { _ in
                completion?()
            }
        }
    }

    static func animateFadeIn(_ view: UIView, delay: TimeInterval = 0, duration: TimeInterval = 0.3) {
        view.alpha = 0
        view.transform = CGAffineTransform(translationX: 0, y: 12)
        UIView.animate(withDuration: duration, delay: delay, options: .curveEaseOut) {
            view.alpha = 1
            view.transform = .identity
        }
    }
}

// MARK: - UIFont Extension for Rounded

extension UIFont {
    static func rounded(ofSize size: CGFloat, weight: UIFont.Weight) -> UIFont {
        let systemFont = UIFont.systemFont(ofSize: size, weight: weight)
        if let descriptor = systemFont.fontDescriptor.withDesign(.rounded) {
            return UIFont(descriptor: descriptor, size: size)
        }
        return systemFont
    }
}

// MARK: - Gradient Button

final class GradientButton: UIButton {
    private let gradientLayer = CAGradientLayer()
    private let iconView = UIImageView()
    private let label = UILabel()
    private let contentStack = UIStackView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        // Gradient background
        gradientLayer.colors = [
            Theme.Colors.primaryGradientStart.cgColor,
            Theme.Colors.primaryGradientEnd.cgColor
        ]
        gradientLayer.startPoint = CGPoint(x: 0, y: 0.5)
        gradientLayer.endPoint = CGPoint(x: 1, y: 0.5)
        gradientLayer.cornerRadius = Theme.Radius.medium
        layer.insertSublayer(gradientLayer, at: 0)

        // Custom content (icon + label) in a centered stack
        iconView.contentMode = .scaleAspectFit
        iconView.tintColor = .white
        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.isHidden = true

        label.textColor = .white
        label.font = Theme.Font.button

        contentStack.axis = .horizontal
        contentStack.spacing = 6
        contentStack.alignment = .center
        contentStack.isUserInteractionEnabled = false
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(contentStack)

        contentStack.addArrangedSubview(iconView)
        contentStack.addArrangedSubview(label)

        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 18),
            iconView.heightAnchor.constraint(equalToConstant: 18),
            contentStack.centerXAnchor.constraint(equalTo: centerXAnchor),
            contentStack.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradientLayer.frame = bounds
    }

    override func setTitle(_ title: String?, for state: UIControl.State) {
        label.text = title
    }

    override func setImage(_ image: UIImage?, for state: UIControl.State) {
        iconView.image = image?.withRenderingMode(.alwaysTemplate)
        iconView.isHidden = (image == nil)
    }
}
