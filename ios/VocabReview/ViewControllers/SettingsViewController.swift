import UIKit

final class SettingsViewController: UIViewController {
    private let store = VocabStore.shared
    private let tokenField = UITextField()
    private let gistIdField = UITextField()
    private let statusLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Theme.Colors.pageBackground
        setupViews()
        loadCredentials()
    }

    private func setupViews() {
        let titleLabel = UILabel()
        titleLabel.text = "GitHub 同步设置"
        titleLabel.font = Theme.Font.title
        titleLabel.textColor = .label

        configureTextField(tokenField, placeholder: "GitHub Token", icon: "key.fill", secure: true)
        configureTextField(gistIdField, placeholder: "Gist ID", icon: "doc.text.fill", secure: false)
        gistIdField.keyboardType = .URL

        let saveButton = GradientButton(type: .system)
        saveButton.setTitle("  保存设置", for: .normal)
        saveButton.setImage(UIImage(systemName: "checkmark.circle.fill"), for: .normal)
        Theme.applyPrimaryStyle(to: saveButton)
        saveButton.addTarget(self, action: #selector(saveSettings), for: .touchUpInside)
        saveButton.addTarget(self, action: #selector(buttonTouchDown(_:)), for: .touchDown)
        saveButton.addTarget(self, action: #selector(buttonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])

        let pullButton = UIButton(type: .system)
        pullButton.setTitle("  从 Gist 拉取", for: .normal)
        pullButton.setImage(UIImage(systemName: "arrow.down.circle.fill"), for: .normal)
        Theme.applySecondaryStyle(to: pullButton)
        pullButton.addTarget(self, action: #selector(pullGist), for: .touchUpInside)
        pullButton.addTarget(self, action: #selector(buttonTouchDown(_:)), for: .touchDown)
        pullButton.addTarget(self, action: #selector(buttonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])

        statusLabel.font = Theme.Font.caption
        statusLabel.textColor = Theme.Colors.subtleText
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center

        let formCard = UIView()
        formCard.backgroundColor = Theme.Colors.cardBackground
        formCard.layer.cornerRadius = Theme.Radius.medium
        Theme.applyCardShadow(to: formCard.layer)

        let formStack = UIStackView(arrangedSubviews: [tokenField, gistIdField])
        formStack.axis = .vertical
        formStack.spacing = Theme.Spacing.md
        formStack.translatesAutoresizingMaskIntoConstraints = false
        formCard.addSubview(formStack)

        NSLayoutConstraint.activate([
            formStack.topAnchor.constraint(equalTo: formCard.topAnchor, constant: Theme.Spacing.xl),
            formStack.leadingAnchor.constraint(equalTo: formCard.leadingAnchor, constant: Theme.Spacing.xl),
            formStack.trailingAnchor.constraint(equalTo: formCard.trailingAnchor, constant: -Theme.Spacing.xl),
            formStack.bottomAnchor.constraint(equalTo: formCard.bottomAnchor, constant: -Theme.Spacing.xl),
            tokenField.heightAnchor.constraint(equalToConstant: 48),
            gistIdField.heightAnchor.constraint(equalToConstant: 48)
        ])

        let stack = UIStackView(arrangedSubviews: [
            titleLabel,
            formCard,
            saveButton,
            pullButton,
            statusLabel
        ])
        stack.axis = .vertical
        stack.spacing = Theme.Spacing.lg
        stack.setCustomSpacing(Theme.Spacing.xxl, after: titleLabel)
        stack.setCustomSpacing(Theme.Spacing.xxl, after: formCard)
        stack.setCustomSpacing(Theme.Spacing.md, after: pullButton)
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: Theme.Spacing.xxl),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: Theme.Spacing.xl),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -Theme.Spacing.xl)
        ])
    }

    private func configureTextField(_ field: UITextField, placeholder: String, icon: String, secure: Bool) {
        field.placeholder = placeholder
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.isSecureTextEntry = secure
        field.font = Theme.Font.body
        field.backgroundColor = Theme.Colors.pageBackground
        field.layer.cornerRadius = Theme.Radius.small
        field.layer.borderWidth = 1
        field.layer.borderColor = Theme.Colors.divider.cgColor

        // Icon
        let iconImage = UIImageView(image: UIImage(systemName: icon))
        iconImage.tintColor = Theme.Colors.subtleText
        iconImage.contentMode = .scaleAspectFit
        iconImage.frame = CGRect(x: 0, y: 0, width: 36, height: 20)
        let container = UIView(frame: CGRect(x: 0, y: 0, width: 44, height: 20))
        iconImage.center = container.center
        container.addSubview(iconImage)
        field.leftView = container
        field.leftViewMode = .always
    }

    private func loadCredentials() {
        let credentials = store.loadCredentials()
        tokenField.text = credentials.token
        gistIdField.text = credentials.gistId
    }

    @objc private func saveSettings() {
        store.saveCredentials(
            token: tokenField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            gistId: gistIdField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        )
        gistIdField.text = store.loadCredentials().gistId
        statusLabel.text = store.lastError ?? "设置已保存"
        statusLabel.textColor = store.lastError != nil ? .systemRed : Theme.Colors.statMastered
    }

    @objc private func pullGist() {
        saveSettings()
        statusLabel.text = "同步中..."
        statusLabel.textColor = Theme.Colors.subtleText
        Task {
            await store.pullFromGist()
            statusLabel.text = store.lastError ?? "拉取成功"
            statusLabel.textColor = store.lastError != nil ? .systemRed : Theme.Colors.statMastered
        }
    }

    // MARK: - Button Feedback

    @objc private func buttonTouchDown(_ sender: UIButton) {
        UIView.animate(withDuration: 0.1, delay: 0, options: .curveEaseIn) {
            sender.transform = CGAffineTransform(scaleX: 0.97, y: 0.97)
        }
    }

    @objc private func buttonTouchUp(_ sender: UIButton) {
        UIView.animate(withDuration: 0.15, delay: 0, options: .curveEaseOut) {
            sender.transform = .identity
        }
    }
}
